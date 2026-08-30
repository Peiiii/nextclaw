use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
};
use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use spin_app::{App, AppComponent, locked::LockedApp};
use spin_core::{Component, async_trait};
use spin_factor_key_value::{KeyValueFactor, runtime_config::spin::MakeKeyValueStore};
use spin_factor_outbound_http::OutboundHttpFactor;
use spin_factor_outbound_networking::OutboundNetworkingFactor;
use spin_factor_sqlite::{ConnectionCreator, SqliteFactor};
use spin_factor_variables::VariablesFactor;
use spin_factor_wasi::{FilesMounter, MountFilesContext, WasiFactor};
use spin_factors::{
    ConfigureAppContext, Factor, FactorData, InitContext, PrepareContext, RuntimeFactors,
    SelfInstanceBuilder,
};
use spin_factors_executor::{ComponentLoader, FactorsExecutor, FactorsExecutorApp};
use spin_key_value_spin::{SpinKeyValueRuntimeConfig, SpinKeyValueStore};
use spin_sqlite_inproc::{InProcConnection, InProcDatabaseLocation};
use spin_variables_static::StaticVariablesProvider;
use tokio::sync::{Mutex, Notify, mpsc, oneshot};
use url::Url;

wasmtime::component::bindgen!({
    path: "wit",
    world: "service-app",
    imports: { default: async },
    exports: { default: async },
});

// Resident protocol v2 is deliberately a separate world so legacy Components
// remain loadable. New Residents get a typed ack/retry return while the runner
// can still adapt the original service world during installed-App migration.
mod resident_v2 {
    wasmtime::component::bindgen!({
        path: "wit",
        world: "service-app-v2",
        imports: { default: async },
        exports: { default: async },
        with: {
            "nextclaw:portable-service/host@0.1.0": super::nextclaw::portable_service::host,
        },
    });
}

use exports::nextclaw::portable_service::service::Action;
use nextclaw::portable_service::host::{
    Host, HttpResponse, LogLevel, RuntimeInfo as GuestRuntimeInfo,
};
use resident_v2::exports::nextclaw::portable_service::resident_v2::{
    Action as ResidentV2Action, EventDisposition as ResidentV2Disposition,
};

const MAX_HTTP_BODY_BYTES: usize = 64 * 1024;
const RUNNER_PROTOCOL_VERSION: &str = "0.2.0";
const MAX_EVENTS_PER_JOB: usize = 256;
const MAX_EVENT_BYTES_PER_JOB: usize = 1024 * 1024;
const MAX_PROGRESS_PER_SECOND: u64 = 10;
const MAX_HOST_CALL_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunnerApp {
    id: String,
    component_path: PathBuf,
    data_directory: PathBuf,
    #[serde(default)]
    allowed_domains: Vec<String>,
    #[serde(default)]
    allowed_provider_ids: Vec<String>,
    #[serde(default)]
    storage_enabled: bool,
    #[serde(default)]
    file_mounts: Vec<RunnerFileMount>,
    /// Kernel-resolved values cross only this stdin control request. They are
    /// intentionally excluded from cache identity and every response/log.
    #[serde(default)]
    secret_variables: BTreeMap<String, String>,
    /// Only slot -> irreversible digest participates in cache invalidation.
    #[serde(default)]
    secret_fingerprints: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunnerFileMount {
    host_path: PathBuf,
    guest_path: String,
    writable: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunnerRequest {
    request_id: String,
    operation: RunnerOperation,
    app: Option<RunnerApp>,
    action_name: Option<String>,
    job_id: Option<String>,
    cancel_reason: Option<String>,
    input: Option<Value>,
    timeout_ms: Option<u64>,
    call_id: Option<String>,
    trace_id: Option<String>,
    host_call_id: Option<String>,
    host_call_result: Option<Value>,
    host_call_error: Option<RunnerError>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum RunnerOperation {
    CancelJob,
    JobStatus,
    ListActions,
    Invoke,
    Stats,
    Stop,
    StartProvider,
    StartResident,
    StartJob,
    DeliverEvent,
    ResolveHostCall,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
enum RunnerOutput {
    Response {
        #[serde(flatten)]
        response: RunnerResponse,
    },
    JobProgress {
        protocol_version: &'static str,
        job_id: String,
        sequence: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        current: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    StreamChunk {
        protocol_version: &'static str,
        job_id: String,
        sequence: u64,
        content: String,
    },
    // Reserved for a future kernel-mediated host-call exchange. No Guest can
    // emit this yet; keeping it in the transport sum type prevents a later
    // host-call flow from changing the NDJSON envelope again.
    #[allow(dead_code)]
    HostCallRequest {
        protocol_version: &'static str,
        host_call_id: String,
        job_id: String,
        sequence: u64,
        call_id: String,
        trace_id: String,
        app_id: String,
        capability: String,
        input: Value,
    },
    JobTerminal {
        protocol_version: &'static str,
        job_id: String,
        sequence: u64,
        status: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<RunnerError>,
    },
}

#[derive(Clone)]
struct TaskHostContext {
    app_id: String,
    job_id: String,
    call_id: String,
    trace_id: String,
    output: mpsc::Sender<RunnerOutput>,
    sequence: Arc<AtomicU64>,
    cancelled: Arc<AtomicBool>,
    cancel_notify: Arc<Notify>,
    terminal_emitted: Arc<AtomicBool>,
    event_count: Arc<AtomicUsize>,
    event_bytes: Arc<AtomicUsize>,
    progress_window_started_at_ms: Arc<AtomicU64>,
    progress_in_window: Arc<AtomicUsize>,
    execution_timeout: Duration,
    next_host_call: Arc<AtomicU64>,
    host_calls: HostCallRegistry,
}

impl TaskHostContext {
    fn next_sequence(&self) -> u64 {
        self.sequence.fetch_add(1, Ordering::Relaxed) + 1
    }

    async fn emit(&self, event: RunnerOutput) -> std::result::Result<(), String> {
        let bytes = serde_json::to_vec(&event).map_err(to_string)?.len();
        let count = self.event_count.fetch_add(1, Ordering::Relaxed) + 1;
        let total_bytes = self.event_bytes.fetch_add(bytes, Ordering::Relaxed) + bytes;
        if count > MAX_EVENTS_PER_JOB || total_bytes > MAX_EVENT_BYTES_PER_JOB {
            return Err("STREAM_BACKPRESSURE_TIMEOUT: per-job event budget exceeded".into());
        }
        tokio::time::timeout(Duration::from_secs(5), self.output.send(event))
            .await
            .map_err(|_| "STREAM_BACKPRESSURE_TIMEOUT: runner output is not draining".to_string())?
            .map_err(|_| "STREAM_BACKPRESSURE_TIMEOUT: runner output closed".to_string())
    }

    async fn wait_cancelled(&self) {
        loop {
            if self.cancelled.load(Ordering::Relaxed) {
                return;
            }
            self.cancel_notify.notified().await;
        }
    }

    async fn report_progress(
        &self,
        current: Option<u64>,
        total: Option<u64>,
        message: Option<String>,
    ) -> std::result::Result<(), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(to_string)?
            .as_millis() as u64;
        let previous = self.progress_window_started_at_ms.load(Ordering::Relaxed);
        if now.saturating_sub(previous) >= 1_000 {
            self.progress_window_started_at_ms
                .store(now, Ordering::Relaxed);
            self.progress_in_window.store(0, Ordering::Relaxed);
        }
        if self.progress_in_window.fetch_add(1, Ordering::Relaxed)
            >= MAX_PROGRESS_PER_SECOND as usize
        {
            return Ok(());
        }
        self.emit(RunnerOutput::JobProgress {
            protocol_version: RUNNER_PROTOCOL_VERSION,
            job_id: self.job_id.clone(),
            sequence: self.next_sequence(),
            current,
            total,
            message,
        })
        .await
    }

    async fn emit_chunk(&self, content: String) -> std::result::Result<(), String> {
        self.emit(RunnerOutput::StreamChunk {
            protocol_version: RUNNER_PROTOCOL_VERSION,
            job_id: self.job_id.clone(),
            sequence: self.next_sequence(),
            content,
        })
        .await
    }

    /// The Guest never receives a provider credential. It gets a typed host
    /// import, which becomes one bounded JSONL request that the Kernel must
    /// explicitly resolve. The request/reply registry is shared only by this
    /// runner process and is cleared on every terminal path.
    async fn host_call(
        &self,
        capability: &str,
        input: Value,
    ) -> std::result::Result<Value, String> {
        if self.cancelled.load(Ordering::Relaxed) {
            return Err("JOB_CANCELLED: job cancellation was requested".into());
        }
        let input_bytes = serde_json::to_vec(&input).map_err(to_string)?.len();
        if input_bytes > MAX_HOST_CALL_BYTES {
            return Err("HOST_CALL_INPUT_TOO_LARGE: capability input exceeds 64 KiB".into());
        }
        let host_call_id = format!(
            "{}:host:{}",
            self.job_id,
            self.next_host_call.fetch_add(1, Ordering::Relaxed) + 1,
        );
        let (reply, response) = oneshot::channel();
        self.host_calls.lock().await.insert(
            host_call_id.clone(),
            PendingHostCall {
                job_id: self.job_id.clone(),
                reply,
            },
        );
        if let Err(error) = self
            .emit(RunnerOutput::HostCallRequest {
                protocol_version: RUNNER_PROTOCOL_VERSION,
                host_call_id: host_call_id.clone(),
                job_id: self.job_id.clone(),
                sequence: self.next_sequence(),
                call_id: self.call_id.clone(),
                trace_id: self.trace_id.clone(),
                app_id: self.app_id.clone(),
                capability: capability.to_owned(),
                input,
            })
            .await
        {
            self.host_calls.lock().await.remove(&host_call_id);
            return Err(error);
        }
        let response = tokio::select! {
            result = response => result.map_err(|_| "HOST_CALL_CANCELLED: host callback was closed".to_string())?,
            _ = self.wait_cancelled() => HostCallResolution { result: Err("JOB_CANCELLED: job cancellation was requested".into()) },
            _ = tokio::time::sleep(self.execution_timeout) => HostCallResolution { result: Err("HOST_CALL_TIMEOUT: host callback exceeded the job budget".into()) },
        };
        self.host_calls.lock().await.remove(&host_call_id);
        response.result
    }

    async fn clear_host_calls(&self) {
        self.host_calls
            .lock()
            .await
            .retain(|_, pending| pending.job_id != self.job_id);
    }

    async fn terminal(
        &self,
        status: &'static str,
        result: Option<Value>,
        error: Option<RunnerError>,
    ) {
        if self.terminal_emitted.swap(true, Ordering::AcqRel) {
            return;
        }
        // Terminal is never displaced by the bounded progress/chunk window:
        // a full stream still needs one authoritative completion fact.
        let event = RunnerOutput::JobTerminal {
            protocol_version: RUNNER_PROTOCOL_VERSION,
            job_id: self.job_id.clone(),
            sequence: self.next_sequence(),
            status,
            result,
            error,
        };
        let _ = tokio::time::timeout(Duration::from_secs(5), self.output.send(event)).await;
    }
}

struct ActiveJob {
    context: TaskHostContext,
}

type HostCallRegistry = Arc<Mutex<HashMap<String, PendingHostCall>>>;

struct PendingHostCall {
    job_id: String,
    reply: oneshot::Sender<HostCallResolution>,
}

struct HostCallResolution {
    result: std::result::Result<Value, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerResponse {
    request_id: String,
    protocol_version: &'static str,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RunnerError>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct RunnerError {
    code: String,
    message: String,
}

#[derive(Clone)]
struct NextClawFactorConfig {
    app: RunnerApp,
    loaded_components: u32,
    providers: ProviderRegistry,
    provider_bridge: Option<ProviderBridge>,
    task: Option<TaskHostContext>,
}

#[derive(Default)]
struct NextClawFactor;

struct NextClawFactorState {
    config: NextClawFactorConfig,
}

impl SelfInstanceBuilder for NextClawFactorState {}

impl Factor for NextClawFactor {
    type RuntimeConfig = NextClawFactorConfig;
    type AppState = NextClawFactorConfig;
    type InstanceBuilder = NextClawFactorState;

    fn init(&mut self, ctx: &mut impl InitContext<Self>) -> Result<()> {
        ctx.link_bindings(nextclaw::portable_service::host::add_to_linker::<_, FactorData<Self>>)?;
        Ok(())
    }

    fn configure_app<T: RuntimeFactors>(
        &self,
        mut ctx: ConfigureAppContext<T, Self>,
    ) -> Result<Self::AppState> {
        ctx.take_runtime_config()
            .context("NextClaw Factor runtime config is required")
    }

    fn prepare<T: RuntimeFactors>(
        &self,
        ctx: PrepareContext<T, Self>,
    ) -> Result<Self::InstanceBuilder> {
        fs::create_dir_all(&ctx.app_state().app.data_directory)?;
        Ok(NextClawFactorState {
            config: ctx.app_state().clone(),
        })
    }
}

#[derive(RuntimeFactors)]
struct SpinFactors {
    wasi: WasiFactor,
    variables: VariablesFactor,
    outbound_networking: OutboundNetworkingFactor,
    outbound_http: OutboundHttpFactor,
    key_value: KeyValueFactor,
    sqlite: SqliteFactor,
    nextclaw: NextClawFactor,
}

type LoadedSpinApp = FactorsExecutorApp<SpinFactors, ()>;
type SpinStore =
    spin_core::Store<spin_factors_executor::InstanceState<SpinFactorsInstanceState, ()>>;

struct ActiveInstance {
    bindings: ServiceApp,
    store: SpinStore,
}

struct ActiveResidentV2Instance {
    bindings: resident_v2::ServiceAppV2,
    store: SpinStore,
}

enum ActiveResidentInstance {
    Legacy(ActiveInstance),
    V2(ActiveResidentV2Instance),
}

type ProviderRegistry = Arc<Mutex<HashMap<String, ActiveInstance>>>;

struct ProviderCall {
    provider_id: String,
    action: String,
    input_json: String,
    reply: oneshot::Sender<std::result::Result<String, String>>,
}

type ProviderBridge = mpsc::UnboundedSender<ProviderCall>;

struct PathComponentLoader {
    component_path: PathBuf,
}

/// Mounts only the kernel-resolved preopens encoded in the generated Spin
/// lock. The runner never interprets a manifest or a raw user grant itself.
struct NextClawFilesMounter;

impl FilesMounter for NextClawFilesMounter {
    fn mount_files(&self, app_component: &AppComponent, mut ctx: MountFilesContext) -> Result<()> {
        for mount in app_component.files() {
            let source = mount
                .content
                .source
                .as_deref()
                .context("Portable filesystem mount is missing a source")?;
            let url = Url::parse(source)
                .with_context(|| format!("Invalid portable filesystem source: {source}"))?;
            anyhow::ensure!(
                url.scheme() == "file",
                "Portable filesystem source must use the file scheme"
            );
            let host_path = url
                .to_file_path()
                .map_err(|_| anyhow!("Portable filesystem source is not a local path"))?;
            let canonical_path = fs::canonicalize(&host_path).with_context(|| {
                format!(
                    "Portable filesystem source does not exist: {}",
                    host_path.display()
                )
            })?;
            anyhow::ensure!(
                fs::metadata(&canonical_path)?.is_dir(),
                "Portable filesystem source is not a directory: {}",
                canonical_path.display()
            );
            let guest_path = mount
                .path
                .to_str()
                .context("Portable filesystem guest path is not UTF-8")?;
            assert_safe_guest_path(guest_path)?;
            let writable = url
                .query_pairs()
                .any(|(key, value)| key == "nextclaw-writable" && value == "1");
            ctx.preopened_dir(canonical_path, guest_path, writable)?;
        }
        Ok(())
    }
}

#[async_trait]
impl ComponentLoader<SpinFactors, ()> for PathComponentLoader {
    async fn load_component(
        &self,
        engine: &spin_core::wasmtime::Engine,
        _component: &AppComponent,
    ) -> Result<Component> {
        Component::from_file(engine, &self.component_path).map_err(|error| {
            anyhow!(
                "failed to load component {}: {error}",
                self.component_path.display()
            )
        })
    }
}

struct Runner {
    executor: Arc<FactorsExecutor<SpinFactors, ()>>,
    apps: HashMap<String, LoadedSpinApp>,
    providers: ProviderRegistry,
    residents: HashMap<String, ActiveResidentInstance>,
    provider_bridge: Option<ProviderBridge>,
    loaded_components_base: u32,
}

impl Runner {
    fn new() -> Result<Self> {
        Self::new_with_job_context(None, 0)
    }

    fn new_with_job_context(
        provider_bridge: Option<ProviderBridge>,
        loaded_components_base: u32,
    ) -> Result<Self> {
        let factors = SpinFactors {
            wasi: WasiFactor::new(NextClawFilesMounter),
            // Variables are deliberately empty until the kernel resolves an
            // App-scoped Secret reference. Never inherit process env/config.
            variables: VariablesFactor::new(),
            outbound_networking: OutboundNetworkingFactor::new(),
            outbound_http: OutboundHttpFactor::default(),
            key_value: KeyValueFactor::new(),
            sqlite: SqliteFactor::new(),
            nextclaw: NextClawFactor,
        };
        let mut engine_config = spin_core::Config::default();
        // Fuel stops CPU-bound Guests that never yield to the async runtime;
        // epoch deadlines cover wall-clock budgets and the cancel token covers
        // cooperative task host checks.
        engine_config.wasmtime_config().consume_fuel(true);
        let engine_builder = spin_core::Engine::builder(&engine_config)?;
        let executor = Arc::new(FactorsExecutor::new(engine_builder, factors)?);
        Ok(Self {
            executor,
            apps: HashMap::new(),
            providers: Arc::new(Mutex::new(HashMap::new())),
            residents: HashMap::new(),
            provider_bridge,
            loaded_components_base,
        })
    }

    async fn handle(&mut self, request: &RunnerRequest) -> Result<Value> {
        match request.operation {
            RunnerOperation::StartJob
            | RunnerOperation::CancelJob
            | RunnerOperation::JobStatus
            | RunnerOperation::ResolveHostCall => Err(anyhow!(
                "job control must be dispatched by the runner transport"
            )),
            RunnerOperation::ListActions => self.list_actions(require_app(request)?).await,
            RunnerOperation::Invoke => {
                self.invoke(
                    require_app(request)?,
                    request
                        .action_name
                        .as_deref()
                        .context("actionName is required")?,
                    request.input.clone().unwrap_or_else(|| json!({})),
                )
                .await
            }
            RunnerOperation::Stats => Ok(json!({
                "runnerPid": std::process::id(),
                "loadedComponents": self.apps.len(),
                "providerInstances": self.providers.lock().await.len(),
                "residentInstances": self.residents.len(),
                "engine": "spin-4.0.2",
            })),
            RunnerOperation::Stop => {
                if let Some(app) = &request.app {
                    self.stop_resident(app, request.input.clone().unwrap_or_else(|| json!({})))
                        .await?;
                    self.stop_provider(app, request.input.clone().unwrap_or_else(|| json!({})))
                        .await?;
                    self.apps.remove(&app_key(app));
                }
                Ok(json!({ "stopped": true }))
            }
            RunnerOperation::StartProvider => {
                self.start_provider(
                    require_app(request)?,
                    request.input.clone().unwrap_or_else(|| json!({})),
                )
                .await
            }
            RunnerOperation::StartResident => {
                self.start_resident(
                    require_app(request)?,
                    request.input.clone().unwrap_or_else(|| json!({})),
                )
                .await
            }
            RunnerOperation::DeliverEvent => {
                self.deliver_event(
                    require_app(request)?,
                    request.input.clone().unwrap_or_else(|| json!({})),
                )
                .await
            }
        }
    }

    async fn list_actions(&mut self, app: &RunnerApp) -> Result<Value> {
        if let Some(provider) = self.providers.lock().await.get_mut(&app.id) {
            let actions = provider
                .bindings
                .nextclaw_portable_service_service()
                .call_list_actions(&mut provider.store)
                .await?;
            return serialize_actions(&actions);
        }
        if let Some(resident) = self.residents.get_mut(&app.id) {
            return match resident {
                ActiveResidentInstance::Legacy(resident) => {
                    let actions = resident
                        .bindings
                        .nextclaw_portable_service_service()
                        .call_list_actions(&mut resident.store)
                        .await?;
                    serialize_actions(&actions)
                }
                ActiveResidentInstance::V2(resident) => {
                    let actions = resident
                        .bindings
                        .nextclaw_portable_service_resident_v2()
                        .call_list_actions(&mut resident.store)
                        .await?;
                    serialize_resident_v2_actions(&actions)
                }
            };
        }
        match self.instantiate(app).await {
            Ok((bindings, mut store)) => {
                let actions = bindings
                    .nextclaw_portable_service_service()
                    .call_list_actions(&mut store)
                    .await?;
                serialize_actions(&actions)
            }
            Err(service_error) => {
                // Candidate-package validation asks for the Action contract
                // before a Resident has entered its persistent lane. A typed
                // v2 Resident exports `resident-v2`, not the legacy `service`
                // interface, so probe the versioned world rather than making
                // enable depend on already having started the component.
                let (bindings, mut store) = self
                    .instantiate_resident_v2(app)
                    .await
                    .with_context(|| {
                        format!(
                            "component exports neither service nor resident-v2 (service probe: {service_error})"
                        )
                    })?;
                let actions = bindings
                    .nextclaw_portable_service_resident_v2()
                    .call_list_actions(&mut store)
                    .await?;
                serialize_resident_v2_actions(&actions)
            }
        }
    }

    /// Every Action has an independent Store. Resident and Provider retain
    /// their own serial lanes only for lifecycle/event work, never for an
    /// unrelated Action or Job.
    async fn invoke(&mut self, app: &RunnerApp, action: &str, input: Value) -> Result<Value> {
        self.invoke_with_task(app, action, input, None).await
    }

    async fn invoke_with_task(
        &mut self,
        app: &RunnerApp,
        action: &str,
        input: Value,
        task: Option<TaskHostContext>,
    ) -> Result<Value> {
        match self.instantiate_with_task(app, task.clone()).await {
            Ok((bindings, mut store)) => {
                let output = bindings
                    .nextclaw_portable_service_service()
                    .call_invoke(&mut store, action, &input.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                parse_guest_json(output)
            }
            Err(_legacy_error) => {
                let (bindings, mut store) =
                    self.instantiate_resident_v2_with_task(app, task).await?;
                let output = bindings
                    .nextclaw_portable_service_resident_v2()
                    .call_invoke(&mut store, action, &input.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                parse_guest_json(output)
            }
        }
    }

    async fn invoke_provider_raw(
        &mut self,
        provider_id: &str,
        action: &str,
        input_json: &str,
    ) -> std::result::Result<String, String> {
        let mut providers = self.providers.lock().await;
        let provider = providers
            .get_mut(provider_id)
            .ok_or_else(|| format!("PROVIDER_NOT_RUNNING: {provider_id}"))?;
        provider
            .bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut provider.store, action, input_json)
            .await
            .map_err(to_string)?
    }

    async fn start_provider(&mut self, app: &RunnerApp, config: Value) -> Result<Value> {
        if self.providers.lock().await.contains_key(&app.id) {
            return Ok(json!({ "started": false, "alreadyRunning": true }));
        }
        let (bindings, mut store) = self.instantiate(app).await?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_start(&mut store, &config.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
        let result = parse_guest_json(output)?;
        self.providers
            .lock()
            .await
            .insert(app.id.clone(), ActiveInstance { bindings, store });
        Ok(result)
    }

    async fn start_resident(&mut self, app: &RunnerApp, config: Value) -> Result<Value> {
        if self.residents.contains_key(&app.id) {
            return Ok(json!({ "started": false, "alreadyRunning": true }));
        }
        // Typed v2 is mandatory for new Resident templates. Existing v1
        // packages remain supported only through this explicit migration
        // adapter and are never misreported as v2.
        match self.instantiate_resident_v2(app).await {
            Ok((bindings, mut store)) => {
                let output = bindings
                    .nextclaw_portable_service_resident_v2()
                    .call_start(&mut store, &config.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                let result = parse_guest_json(output)?;
                self.residents.insert(
                    app.id.clone(),
                    ActiveResidentInstance::V2(ActiveResidentV2Instance { bindings, store }),
                );
                Ok(result)
            }
            Err(_v2_error) => {
                let (bindings, mut store) = self.instantiate(app).await?;
                let output = bindings
                    .nextclaw_portable_service_service()
                    .call_start(&mut store, &config.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                let result = parse_guest_json(output)?;
                self.residents.insert(
                    app.id.clone(),
                    ActiveResidentInstance::Legacy(ActiveInstance { bindings, store }),
                );
                Ok(result)
            }
        }
    }

    async fn deliver_event(&mut self, app: &RunnerApp, event: Value) -> Result<Value> {
        let resident = self
            .residents
            .get_mut(&app.id)
            .with_context(|| format!("resident instance {} is not running", app.id))?;
        match resident {
            ActiveResidentInstance::Legacy(resident) => {
                let output = resident
                    .bindings
                    .nextclaw_portable_service_service()
                    .call_handle_event(&mut resident.store, &event.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                // Explicit v1 adapter: a successful legacy call acknowledges
                // delivery. The Kernel never labels this as a typed v2 fact.
                let _legacy_result = parse_guest_json(output)?;
                Ok(json!({ "disposition": "ack", "abi": "legacy-0.1" }))
            }
            ActiveResidentInstance::V2(resident) => {
                let disposition = resident
                    .bindings
                    .nextclaw_portable_service_resident_v2()
                    .call_handle_event(&mut resident.store, &event.to_string())
                    .await?
                    .map_err(|message| anyhow!(message))?;
                Ok(match disposition {
                    ResidentV2Disposition::Ack => {
                        json!({ "disposition": "ack", "abi": "typed-0.2" })
                    }
                    ResidentV2Disposition::Retry(retry) => json!({
                        "disposition": "retry",
                        "delayMs": retry.delay_ms,
                        "error": retry.error_message.map(|message| json!({
                            "code": retry.error_code,
                            "message": message,
                        })),
                        "abi": "typed-0.2",
                    }),
                })
            }
        }
    }

    async fn stop_resident(&mut self, app: &RunnerApp, reason: Value) -> Result<()> {
        let Some(mut resident) = self.residents.remove(&app.id) else {
            return Ok(());
        };
        match &mut resident {
            ActiveResidentInstance::Legacy(resident) => resident
                .bindings
                .nextclaw_portable_service_service()
                .call_stop(&mut resident.store, &reason.to_string())
                .await?
                .map_err(|message| anyhow!(message))?,
            ActiveResidentInstance::V2(resident) => resident
                .bindings
                .nextclaw_portable_service_resident_v2()
                .call_stop(&mut resident.store, &reason.to_string())
                .await?
                .map_err(|message| anyhow!(message))?,
        };
        Ok(())
    }

    async fn stop_provider(&mut self, app: &RunnerApp, reason: Value) -> Result<()> {
        let Some(mut provider) = self.providers.lock().await.remove(&app.id) else {
            return Ok(());
        };
        provider
            .bindings
            .nextclaw_portable_service_service()
            .call_stop(&mut provider.store, &reason.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
        Ok(())
    }

    async fn instantiate(&mut self, app: &RunnerApp) -> Result<(ServiceApp, SpinStore)> {
        let loaded = self.loaded_app(app).await?;
        let mut builder = loaded.prepare("service")?;
        builder.store_builder().max_memory_size(64 * 1024 * 1024);
        let (instance, mut store) = builder.instantiate(()).await?;
        store.as_mut().set_fuel(500_000_000)?;
        let bindings = ServiceApp::new(&mut store, &instance)?;
        Ok((bindings, store))
    }

    async fn instantiate_resident_v2(
        &mut self,
        app: &RunnerApp,
    ) -> Result<(resident_v2::ServiceAppV2, SpinStore)> {
        let loaded = self.loaded_app(app).await?;
        let mut builder = loaded.prepare("service")?;
        builder.store_builder().max_memory_size(64 * 1024 * 1024);
        let (instance, mut store) = builder.instantiate(()).await?;
        store.as_mut().set_fuel(500_000_000)?;
        let bindings = resident_v2::ServiceAppV2::new(&mut store, &instance)?;
        Ok((bindings, store))
    }

    async fn instantiate_resident_v2_with_task(
        &mut self,
        app: &RunnerApp,
        task: Option<TaskHostContext>,
    ) -> Result<(resident_v2::ServiceAppV2, SpinStore)> {
        if task.is_none() {
            return self.instantiate_resident_v2(app).await;
        }
        let task = task.expect("checked above");
        let loaded = self.load_uncached(app, Some(task.clone())).await?;
        let mut builder = loaded.prepare("service")?;
        builder.store_builder().max_memory_size(64 * 1024 * 1024);
        let (instance, mut store) = builder.instantiate(()).await?;
        store.set_deadline(std::time::Instant::now() + task.execution_timeout);
        store.as_mut().set_fuel(500_000_000)?;
        let bindings = resident_v2::ServiceAppV2::new(&mut store, &instance)?;
        Ok((bindings, store))
    }

    /// Job factors are deliberately not cached: their task host import owns a
    /// job-specific cancel token and bounded event channel. Reusing a cached
    /// factor here would cross those identities even if Store allocation were
    /// separate.
    async fn instantiate_with_task(
        &mut self,
        app: &RunnerApp,
        task: Option<TaskHostContext>,
    ) -> Result<(ServiceApp, SpinStore)> {
        if task.is_none() {
            return self.instantiate(app).await;
        }
        let loaded = self.load_uncached(app, task.clone()).await?;
        let mut builder = loaded.prepare("service")?;
        builder.store_builder().max_memory_size(64 * 1024 * 1024);
        let (instance, mut store) = builder.instantiate(()).await?;
        if let Some(task) = task {
            store.set_deadline(std::time::Instant::now() + task.execution_timeout);
            store.as_mut().set_fuel(20_000_000)?;
        }
        let bindings = ServiceApp::new(&mut store, &instance)?;
        Ok((bindings, store))
    }

    async fn loaded_app(&mut self, app: &RunnerApp) -> Result<&LoadedSpinApp> {
        let key = app_key(app);
        if !self.apps.contains_key(&key) {
            let loaded = self.load_app(app, None).await?;
            self.apps.insert(key.clone(), loaded);
        }
        self.apps
            .get(&key)
            .context("Spin app cache entry disappeared")
    }

    async fn load_uncached(
        &self,
        app: &RunnerApp,
        task: Option<TaskHostContext>,
    ) -> Result<LoadedSpinApp> {
        self.load_app(app, task).await
    }

    async fn load_app(
        &self,
        app: &RunnerApp,
        task: Option<TaskHostContext>,
    ) -> Result<LoadedSpinApp> {
        let locked = locked_app_for(app)?;
        let spin_app = App::new(format!("nextclaw:{}", app.id), locked);
        let config = spin_factors_runtime_config(
            app,
            NextClawFactorConfig {
                app: app.clone(),
                loaded_components: self.loaded_components_base + self.apps.len() as u32,
                providers: Arc::clone(&self.providers),
                provider_bridge: self.provider_bridge.clone(),
                task,
            },
        )?;
        Arc::clone(&self.executor)
            .load_app(
                spin_app,
                config,
                &PathComponentLoader {
                    component_path: app.component_path.clone(),
                },
                None,
            )
            .await
    }
}

/// Build the minimal synthetic Spin lock from a kernel-resolved App snapshot.
/// Standard factor metadata is generated here, rather than copied from the
/// package manifest, so a runner can never gain capability merely by parsing
/// an artifact-declared request.
fn locked_app_for(app: &RunnerApp) -> Result<LockedApp> {
    let mut metadata = serde_json::Map::new();
    let allowed_hosts = spin_allowed_hosts(&app.allowed_domains)?;
    if !allowed_hosts.is_empty() {
        metadata.insert("allowed_outbound_hosts".into(), json!(allowed_hosts));
    }
    if app.storage_enabled {
        metadata.insert("key_value_stores".into(), json!(["default"]));
        metadata.insert("databases".into(), json!(["default"]));
    }
    let variables = app
        .secret_variables
        .keys()
        .map(|slot| (slot.clone(), json!({})))
        .collect::<serde_json::Map<_, _>>();
    // VariablesFactor exposes only component config entries. These templates
    // carry synthetic variable names, never kernel-resolved secret values.
    let component_config = app
        .secret_variables
        .keys()
        .map(|slot| (slot.clone(), json!(format!("{{{{{slot}}}}}"))))
        .collect::<serde_json::Map<_, _>>();
    Ok(serde_json::from_value(json!({
        "spin_lock_version": 1,
        // The variable declaration is synthesized from the kernel snapshot,
        // never from package metadata. Spin's standard wasi:config/store
        // surface is therefore the sole Guest secret-consumption path.
        "variables": variables,
        "triggers": [],
        "components": [{
            "id": "service",
            "metadata": metadata,
            "source": {
                "content_type": "application/wasm",
                "content": {}
            },
            "config": component_config,
            "files": runner_file_mounts(app)?
        }]
    }))?)
}

/// Map the product's host-only allowlist to Spin's scheme-aware policy.
/// Existing manifests allow a declared domain and its subdomains; we preserve
/// that contract without widening it to arbitrary schemes or ports.
fn spin_allowed_hosts(domains: &[String]) -> Result<Vec<String>> {
    let mut allowed = Vec::new();
    for raw_domain in domains {
        let domain = raw_domain.trim().trim_end_matches('.').to_ascii_lowercase();
        anyhow::ensure!(
            !domain.is_empty()
                && !domain.contains("//")
                && !domain.contains('/')
                && !domain.contains('?')
                && !domain.contains('#')
                && !domain.contains('@')
                && !domain.contains(':')
                && domain
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-'),
            "NETWORK_DENIED: invalid allowed domain"
        );
        allowed.push(format!("https://{domain}"));
        allowed.push(format!("https://*.{domain}"));
    }
    allowed.sort();
    allowed.dedup();
    Ok(allowed)
}

/// Runtime configuration owns the physical stores. Each loaded synthetic App
/// receives its own configuration, rooted in its already-isolated instance
/// directory. `default` is the only label exposed to a Component.
fn spin_factors_runtime_config(
    app: &RunnerApp,
    nextclaw: NextClawFactorConfig,
) -> Result<SpinFactorsRuntimeConfig> {
    let mut key_value = spin_factor_key_value::RuntimeConfig::default();
    let mut sqlite = spin_factor_sqlite::RuntimeConfig::default();
    if app.storage_enabled {
        migrate_legacy_json_kv(&app.data_directory)?;
        let kv_store = SpinKeyValueStore::new(Some(app.data_directory.clone())).make_store(
            SpinKeyValueRuntimeConfig::new(Some(PathBuf::from("portable-kv.sqlite"))),
        )?;
        key_value.add_store_manager("default".into(), Arc::new(kv_store));

        let sqlite_path = app.data_directory.join("portable-runtime.sqlite");
        let sqlite_factory = move || {
            let location = InProcDatabaseLocation::from_path(Some(sqlite_path.clone()))
                .map_err(|error| anyhow!(error.to_string()))?;
            let connection = InProcConnection::new(location, false)
                .map_err(|error| anyhow!(error.to_string()))?;
            Ok(Arc::new(connection) as Arc<dyn spin_factor_sqlite::Connection>)
        };
        sqlite.connection_creators.insert(
            "default".into(),
            Arc::new(sqlite_factory) as Arc<dyn ConnectionCreator>,
        );
    }
    let variables = spin_factor_variables::runtime_config::RuntimeConfig {
        providers: vec![Box::new(StaticVariablesProvider::new(
            app.secret_variables.clone(),
        ))],
    };
    Ok(SpinFactorsRuntimeConfig {
        wasi: None,
        variables: Some(variables),
        outbound_networking: Some(
            spin_factor_outbound_networking::runtime_config::RuntimeConfig {
                // Spin's blanket non-global filter also rejects 198.18.0.0/15,
                // which transparent system proxies commonly use as a DNS
                // fake-IP pool. Keep actual local/reserved destinations
                // blocked explicitly while allowing that non-routable proxy
                // transport; the declared HTTPS hostname allowlist still
                // remains authoritative.
                blocked_ip_networks: nextclaw_blocked_ip_networks()?,
                block_private_networks: false,
                client_tls_configs: vec![],
            },
        ),
        outbound_http: None,
        key_value: Some(key_value),
        sqlite: Some(sqlite),
        nextclaw: Some(nextclaw),
    })
}

fn nextclaw_blocked_ip_networks() -> Result<Vec<ip_network::IpNetwork>> {
    [
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.0.2.0/24",
        "192.88.99.0/24",
        "192.168.0.0/16",
        "198.51.100.0/24",
        "203.0.113.0/24",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::/128",
        "::1/128",
        "64:ff9b:1::/48",
        "100::/64",
        "2001:db8::/32",
        "fc00::/7",
        "fe80::/10",
        "ff00::/8",
    ]
    .into_iter()
    .map(str::parse)
    .collect::<std::result::Result<Vec<_>, _>>()
    .map_err(|error| anyhow!("Invalid built-in blocked network: {error}"))
}

/// One-way compatibility migration from the original JSON file to the SQLite
/// schema used by SpinKeyValueStore. The old payload remains recoverable as a
/// clearly isolated `.legacy.json` file and is never used by the runner again.
fn migrate_legacy_json_kv(data_directory: &PathBuf) -> Result<()> {
    let legacy_path = data_directory.join("portable-kv.json");
    if !legacy_path.exists() {
        return Ok(());
    }
    let values: HashMap<String, String> = serde_json::from_slice(&fs::read(&legacy_path)?)
        .context("Portable legacy KV file is not valid JSON")?;
    let database_path = data_directory.join("portable-kv.sqlite");
    let mut connection = open_portable_kv_database(&database_path)?;
    let transaction = connection.transaction()?;
    for (key, value) in values {
        assert_safe_key(&key).map_err(|error| anyhow!(error))?;
        transaction.execute(
            "INSERT INTO spin_key_value (store, key, value) VALUES (?1, ?2, ?3)
             ON CONFLICT(store, key) DO NOTHING",
            rusqlite::params!["default", key, value.into_bytes()],
        )?;
    }
    transaction.commit()?;
    fs::rename(&legacy_path, next_legacy_archive_path(data_directory))?;
    Ok(())
}

fn next_legacy_archive_path(data_directory: &PathBuf) -> PathBuf {
    let base = data_directory.join("portable-kv.legacy.json");
    if !base.exists() {
        return base;
    }
    for revision in 1u32.. {
        let candidate = data_directory.join(format!("portable-kv.legacy.{revision}.json"));
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!("u32 archive suffix space is exhausted")
}

fn open_portable_kv_database(path: &PathBuf) -> Result<rusqlite::Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let connection = rusqlite::Connection::open(path)?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    connection.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS spin_key_value (
           store TEXT NOT NULL,
           key TEXT NOT NULL,
           value BLOB NOT NULL,
           PRIMARY KEY (store, key)
         );",
    )?;
    Ok(connection)
}

fn runner_file_mounts(app: &RunnerApp) -> Result<Vec<Value>> {
    app.file_mounts
        .iter()
        .map(|mount| {
            assert_safe_guest_path(&mount.guest_path)?;
            let canonical_path = fs::canonicalize(&mount.host_path).with_context(|| {
                format!(
                    "Portable filesystem source does not exist: {}",
                    mount.host_path.display()
                )
            })?;
            anyhow::ensure!(
                fs::metadata(&canonical_path)?.is_dir(),
                "Portable filesystem source is not a directory: {}",
                canonical_path.display()
            );
            let mut source = Url::from_file_path(&canonical_path).map_err(|_| {
                anyhow!(
                    "Could not encode portable filesystem source: {}",
                    canonical_path.display()
                )
            })?;
            if mount.writable {
                source
                    .query_pairs_mut()
                    .append_pair("nextclaw-writable", "1");
            }
            Ok(json!({
                "source": source.to_string(),
                "path": mount.guest_path,
            }))
        })
        .collect()
}

impl Host for NextClawFactorState {
    async fn log(&mut self, level: LogLevel, message: String) {
        let level = match level {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        };
        eprintln!(
            "[portable-runtime][{}][{}] {}",
            self.config.app.id, level, message
        );
    }

    async fn kv_get(&mut self, key: String) -> std::result::Result<Option<String>, String> {
        self.assert_storage_enabled()?;
        assert_safe_key(&key)?;
        self.read_legacy_kv(&key)
    }

    async fn kv_set(&mut self, key: String, value: String) -> std::result::Result<(), String> {
        self.assert_storage_enabled()?;
        assert_safe_key(&key)?;
        self.write_legacy_kv(&key, &value)
    }

    /// Compatibility for the original host WIT. New Components must use the
    /// Spin/WASI outbound HTTP import, whose policy is built from the same
    /// kernel-resolved metadata in `locked_app_for`.
    async fn http_get(&mut self, raw_url: String) -> std::result::Result<HttpResponse, String> {
        let url = Url::parse(&raw_url).map_err(to_string)?;
        if url.scheme() != "https" {
            return Err("NETWORK_DENIED: only https URLs are allowed".into());
        }
        let host = url
            .host_str()
            .ok_or_else(|| "NETWORK_DENIED: URL has no host".to_string())?;
        let allowed = self
            .config
            .app
            .allowed_domains
            .iter()
            .any(|domain| host == domain || host.ends_with(&format!(".{domain}")));
        if !allowed {
            return Err(format!("NETWORK_DENIED: {host} is not in allowedDomains"));
        }
        let response = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(to_string)?
            .get(url)
            .send()
            .await
            .map_err(to_string)?;
        let status = response.status().as_u16();
        let bytes = response.bytes().await.map_err(to_string)?;
        if bytes.len() > MAX_HTTP_BODY_BYTES {
            return Err(format!("HTTP_BODY_TOO_LARGE: {} bytes", bytes.len()));
        }
        Ok(HttpResponse {
            status,
            body: String::from_utf8_lossy(&bytes).into_owned(),
        })
    }

    async fn component_call(
        &mut self,
        provider_id: String,
        _action: String,
        _input_json: String,
    ) -> std::result::Result<String, String> {
        if !self.config.app.allowed_provider_ids.contains(&provider_id) {
            return Err(format!(
                "PROVIDER_DENIED: {} did not declare provider {}",
                self.config.app.id, provider_id
            ));
        }
        if let Some(bridge) = &self.config.provider_bridge {
            let (reply, response) = oneshot::channel();
            bridge
                .send(ProviderCall {
                    provider_id,
                    action: _action,
                    input_json: _input_json,
                    reply,
                })
                .map_err(|_| {
                    "PROVIDER_NOT_RUNNING: runner provider lane is unavailable".to_string()
                })?;
            return response
                .await
                .map_err(|_| "PROVIDER_NOT_RUNNING: provider lane exited".to_string())?;
        }
        let mut providers = self.config.providers.lock().await;
        let provider = providers
            .get_mut(&provider_id)
            .ok_or_else(|| format!("PROVIDER_NOT_RUNNING: {provider_id}"))?;
        provider
            .bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut provider.store, &_action, &_input_json)
            .await
            .map_err(to_string)?
    }

    async fn get_runtime_info(&mut self) -> GuestRuntimeInfo {
        GuestRuntimeInfo {
            runner_pid: std::process::id(),
            loaded_components: self.config.loaded_components,
            component_id: self.config.app.id.clone(),
        }
    }

    async fn model_complete(
        &mut self,
        input: nextclaw::portable_service::host::ModelCompleteInput,
    ) -> std::result::Result<String, String> {
        let messages: Value = serde_json::from_str(&input.messages_json)
            .map_err(|_| "INVALID_INPUT: model messagesJson must be valid JSON".to_string())?;
        if !messages.is_array() {
            return Err("INVALID_INPUT: model messagesJson must be an array".into());
        }
        let response = self
            .task_host_call(
                "model-complete",
                json!({
                    "slotId": input.slot_id,
                    "messages": messages,
                    "maxTokens": input.max_tokens,
                }),
            )
            .await?;
        serialize_host_call_result(response)
    }

    async fn agent_start(
        &mut self,
        input: nextclaw::portable_service::host::AgentStartInput,
    ) -> std::result::Result<String, String> {
        let agent_input: Value = serde_json::from_str(&input.input_json)
            .map_err(|_| "INVALID_INPUT: agent inputJson must be valid JSON".to_string())?;
        if !agent_input.is_object() {
            return Err("INVALID_INPUT: agent inputJson must be an object".into());
        }
        let response = self
            .task_host_call(
                "agent-start",
                json!({
                    "slotId": input.slot_id,
                    "input": agent_input,
                }),
            )
            .await?;
        serialize_host_call_result(response)
    }

    async fn report_progress(
        &mut self,
        current: Option<u64>,
        total: Option<u64>,
        message: Option<String>,
    ) -> std::result::Result<(), String> {
        let task = self.config.task.as_ref().ok_or_else(|| {
            "TASK_UNAVAILABLE: progress is only available during a Job".to_string()
        })?;
        task.report_progress(current, total, message).await
    }

    async fn emit_chunk(&mut self, content: String) -> std::result::Result<(), String> {
        let task = self.config.task.as_ref().ok_or_else(|| {
            "TASK_UNAVAILABLE: stream chunks are only available during a Job".to_string()
        })?;
        task.emit_chunk(content).await
    }

    async fn check_cancelled(&mut self) -> bool {
        self.config
            .task
            .as_ref()
            .is_some_and(|task| task.cancelled.load(Ordering::Relaxed))
    }
}

impl NextClawFactorState {
    async fn task_host_call(
        &self,
        capability: &str,
        input: Value,
    ) -> std::result::Result<Value, String> {
        let task = self.config.task.as_ref().ok_or_else(|| {
            "TASK_UNAVAILABLE: AI capability calls are only available during a Job".to_string()
        })?;
        task.host_call(capability, input).await
    }
    fn assert_storage_enabled(&self) -> std::result::Result<(), String> {
        if self.config.app.storage_enabled {
            Ok(())
        } else {
            Err("CAPABILITY_DENIED: storage permission is required".into())
        }
    }

    /// Compatibility implementation for the original NextClaw host WIT.
    /// It writes the same SQLite table used by Spin's KeyValueFactor, so an
    /// upgrade cannot strand legacy lab data in a separate active store.
    fn legacy_kv_database_path(&self) -> PathBuf {
        self.config.app.data_directory.join("portable-kv.sqlite")
    }

    fn read_legacy_kv(&self, key: &str) -> std::result::Result<Option<String>, String> {
        let connection =
            open_portable_kv_database(&self.legacy_kv_database_path()).map_err(to_string)?;
        connection
            .query_row(
                "SELECT value FROM spin_key_value WHERE store = ?1 AND key = ?2",
                rusqlite::params!["default", key],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .map(|bytes| Some(String::from_utf8_lossy(&bytes).into_owned()))
            .or_else(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                error => Err(error),
            })
            .map_err(to_string)
    }

    fn write_legacy_kv(&self, key: &str, value: &str) -> std::result::Result<(), String> {
        let connection =
            open_portable_kv_database(&self.legacy_kv_database_path()).map_err(to_string)?;
        connection
            .execute(
                "INSERT INTO spin_key_value (store, key, value) VALUES (?1, ?2, ?3)
                 ON CONFLICT(store, key) DO UPDATE SET value = excluded.value",
                rusqlite::params!["default", key, value.as_bytes()],
            )
            .map(drop)
            .map_err(to_string)
    }
}

fn app_key(app: &RunnerApp) -> String {
    format!(
        "{}:{}:{}:{}:{:?}:{:?}:{:?}:{:?}",
        app.id,
        app.component_path.display(),
        app.data_directory.display(),
        app.storage_enabled,
        app.allowed_domains,
        app.allowed_provider_ids,
        app.file_mounts,
        app.secret_fingerprints,
    )
}

fn serialize_actions(actions: &[Action]) -> Result<Value> {
    Ok(serde_json::to_value(
        actions
            .iter()
            .map(|action| {
                json!({
                    "name": action.name,
                    "title": action.title,
                    "description": action.description,
                })
            })
            .collect::<Vec<_>>(),
    )?)
}

fn serialize_resident_v2_actions(actions: &[ResidentV2Action]) -> Result<Value> {
    Ok(serde_json::to_value(
        actions
            .iter()
            .map(|action| {
                json!({
                    "name": action.name,
                    "title": action.title,
                    "description": action.description,
                })
            })
            .collect::<Vec<_>>(),
    )?)
}

fn parse_guest_json(output: String) -> Result<Value> {
    serde_json::from_str(&output).or_else(|_| Ok(Value::String(output)))
}

fn require_app(request: &RunnerRequest) -> Result<&RunnerApp> {
    request.app.as_ref().context("app is required")
}

fn assert_safe_key(key: &str) -> std::result::Result<(), String> {
    if key.is_empty()
        || key.len() > 128
        || !key
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._-".contains(character))
    {
        return Err(
            "INVALID_KV_KEY: use 1-128 ASCII letters, digits, dot, dash or underscore".into(),
        );
    }
    Ok(())
}

fn assert_safe_guest_path(path: &str) -> Result<()> {
    let candidate = std::path::Path::new(path);
    anyhow::ensure!(
        candidate.is_absolute(),
        "Portable filesystem guest path must be absolute"
    );
    anyhow::ensure!(
        !path
            .split('/')
            .any(|segment| segment == "." || segment == ".."),
        "Portable filesystem guest path must not contain . or .."
    );
    anyhow::ensure!(
        candidate.components().all(|component| matches!(
            component,
            std::path::Component::RootDir | std::path::Component::Normal(_)
        )),
        "Portable filesystem guest path must not contain . or .."
    );
    Ok(())
}

fn to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn classify_error(error: &anyhow::Error) -> &'static str {
    let message = format!("{error:#}");
    if message.contains("JOB_CANCELLED") {
        return "JOB_CANCELLED";
    }
    if message.contains("CAPABILITY_DENIED")
        || message.contains("NETWORK_DENIED")
        || message.contains("PROVIDER_DENIED")
    {
        return "WASI_CAPABILITY_DENIED";
    }
    if message.contains("INVALID_INPUT") || message.contains("INPUT_SCHEMA") {
        return "WASI_INPUT_SCHEMA_MISMATCH";
    }
    if message.contains("unknown export")
        || message.contains("export not found")
        || message.contains("missing export")
    {
        return "WASI_GUEST_EXPORT_MISSING";
    }
    if message.contains("component type")
        || message.contains("type mismatch")
        || message.contains("incompatible import")
    {
        return "WASI_ABI_VERSION_MISMATCH";
    }
    if message.contains("all fuel consumed") || message.contains("epoch deadline") {
        return "PORTABLE_RUNTIME_TIMEOUT";
    }
    if message.contains("trap") || message.contains("unreachable") {
        return "WASI_COMPONENT_TRAP";
    }
    "WASI_COMPONENT_FAILED"
}

fn response_for(request_id: String, result: Result<Value>) -> RunnerResponse {
    match result {
        Ok(result) => RunnerResponse {
            request_id,
            protocol_version: RUNNER_PROTOCOL_VERSION,
            ok: true,
            result: Some(result),
            error: None,
        },
        Err(error) => RunnerResponse {
            request_id,
            protocol_version: RUNNER_PROTOCOL_VERSION,
            ok: false,
            result: None,
            error: Some(RunnerError {
                code: classify_error(&error).into(),
                message: format!("{error:#}"),
            }),
        },
    }
}

fn serialize_host_call_result(value: Value) -> std::result::Result<String, String> {
    let encoded = serde_json::to_string(&value).map_err(to_string)?;
    if encoded.len() > MAX_HOST_CALL_BYTES {
        return Err("HOST_CALL_OUTPUT_TOO_LARGE: host callback output exceeds 64 KiB".into());
    }
    Ok(encoded)
}

// Spin's standard keyvalue store may use blocking work internally and requires
// Tokio's multi-thread runtime. Component Stores remain !Send, so dispatch
// still runs inside this LocalSet and never crosses worker threads.
fn main() -> Result<()> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()?;
    let local = tokio::task::LocalSet::new();
    local.block_on(&runtime, async move {
        let runner = Rc::new(Mutex::new(Runner::new()?));
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<String>();
        let (output_tx, mut output_rx) = mpsc::channel::<RunnerOutput>(1024);
        let jobs = Rc::new(Mutex::new(HashMap::<String, ActiveJob>::new()));
        let host_calls: HostCallRegistry = Arc::new(Mutex::new(HashMap::new()));
        let (job_complete_tx, mut job_complete_rx) = mpsc::unbounded_channel::<String>();
        let (provider_bridge, mut provider_calls) = mpsc::unbounded_channel::<ProviderCall>();

        // stdin is a dedicated blocking reader. It never awaits component
        // execution, so cancel/status control can enter while a Guest runs.
        std::thread::spawn(move || {
            let stdin = std::io::stdin();
            for line in std::io::BufRead::lines(stdin.lock()) {
                match line {
                    Ok(line) if !line.trim().is_empty() => {
                        if input_tx.send(line).is_err() { break; }
                    }
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
        });

        // stdout has exactly one owner; every response and unsolicited event
        // is serialized through this bounded channel.
        tokio::task::spawn_local(async move {
            let mut stdout = std::io::stdout().lock();
            while let Some(output) = output_rx.recv().await {
                if serde_json::to_writer(&mut stdout, &output).is_err()
                    || stdout.write_all(b"\n").is_err()
                    || stdout.flush().is_err()
                {
                    break;
                }
            }
        });

        loop {
            let line = tokio::select! {
                Some(line) = input_rx.recv() => line,
                Some(job_id) = job_complete_rx.recv() => {
                    jobs.lock().await.remove(&job_id);
                    continue;
                }
                Some(call) = provider_calls.recv() => {
                    let result = runner.lock().await
                        .invoke_provider_raw(&call.provider_id, &call.action, &call.input_json)
                        .await;
                    let _ = call.reply.send(result);
                    continue;
                }
                else => break,
            };
            let request = match serde_json::from_str::<RunnerRequest>(&line) {
                Ok(request) => request,
                Err(error) => {
                    let _ = output_tx.send(RunnerOutput::Response { response: RunnerResponse {
                        request_id: "unknown".into(), protocol_version: RUNNER_PROTOCOL_VERSION,
                        ok: false, result: None, error: Some(RunnerError {
                            code: "INVALID_REQUEST".into(), message: error.to_string(),
                        }),
                    }}).await;
                    continue;
                }
            };
            match request.operation.clone() {
                RunnerOperation::StartJob => {
                    let job_id = request.job_id.clone().unwrap_or_else(|| request.request_id.clone());
                    let Some(app) = request.app.clone() else {
                        let _ = output_tx.send(RunnerOutput::Response { response: response_for(
                            request.request_id, Err(anyhow!("app is required")),
                        ) }).await;
                        continue;
                    };
                    let Some(action_name) = request.action_name.clone() else {
                        let _ = output_tx.send(RunnerOutput::Response { response: response_for(
                            request.request_id, Err(anyhow!("actionName is required")),
                        ) }).await;
                        continue;
                    };
                    let loaded_components = match async {
                        let mut runner = runner.lock().await;
                        runner.loaded_app(&app).await?;
                        Ok::<u32, anyhow::Error>(runner.apps.len() as u32)
                    }.await {
                        Ok(count) => count,
                        Err(error) => {
                            let _ = output_tx.send(RunnerOutput::Response { response: response_for(
                                request.request_id, Err(error),
                            ) }).await;
                            continue;
                        }
                    };
                    let context = TaskHostContext {
                        app_id: app.id.clone(),
                        job_id: job_id.clone(),
                        call_id: request.call_id.clone().unwrap_or_else(|| job_id.clone()),
                        trace_id: request.trace_id.clone().unwrap_or_else(|| job_id.clone()),
                        output: output_tx.clone(),
                        sequence: Arc::new(AtomicU64::new(0)), cancelled: Arc::new(AtomicBool::new(false)),
                        cancel_notify: Arc::new(Notify::new()),
                        terminal_emitted: Arc::new(AtomicBool::new(false)),
                        event_count: Arc::new(AtomicUsize::new(0)), event_bytes: Arc::new(AtomicUsize::new(0)),
                        progress_window_started_at_ms: Arc::new(AtomicU64::new(0)),
                        progress_in_window: Arc::new(AtomicUsize::new(0)),
                        execution_timeout: Duration::from_millis(request.timeout_ms.unwrap_or(7_000).clamp(1, 60_000)),
                        next_host_call: Arc::new(AtomicU64::new(0)),
                        host_calls: Arc::clone(&host_calls),
                    };
                    let task_context = context.clone();
                    let task_complete_tx = job_complete_tx.clone();
                    let task_provider_bridge = provider_bridge.clone();
                    let input = request.input.clone().unwrap_or_else(|| json!({}));
                    // Task Stores must remain !Send, but Spin's standard KV
                    // factor uses Tokio block_in_place. A per-job OS thread
                    // owns a multi-thread Tokio runtime, so neither that
                    // blocking bridge nor a slow Guest can occupy dispatch.
                    std::thread::spawn(move || {
                        let runtime = match tokio::runtime::Builder::new_multi_thread()
                            .worker_threads(2)
                            .enable_all()
                            .build()
                        {
                            Ok(runtime) => runtime,
                            Err(error) => {
                                let context = task_context.clone();
                                let _ = tokio::runtime::Builder::new_current_thread()
                                    .enable_all()
                                    .build()
                                    .map(|fallback| fallback.block_on(context.terminal("failed", None, Some(RunnerError {
                                        code: "PORTABLE_RUNNER_INIT_FAILED".into(), message: error.to_string(),
                                    }))));
                                let _ = task_complete_tx.send(task_context.job_id.clone());
                                return;
                            }
                        };
                        let result = runtime.block_on(async {
                            let mut task_runner = Runner::new_with_job_context(
                                Some(task_provider_bridge),
                                loaded_components,
                            )?;
                            tokio::select! {
                                result = task_runner.invoke_with_task(&app, &action_name, input, Some(task_context.clone())) => result,
                                _ = task_context.wait_cancelled() => Err(anyhow!("JOB_CANCELLED: job cancellation was requested")),
                                _ = tokio::time::sleep(task_context.execution_timeout) => Err(anyhow!("PORTABLE_RUNTIME_TIMEOUT: task timed out")),
                            }
                        });
                        let (status, result, error) = match result {
                            Ok(value) => ("succeeded", Some(value), None),
                            Err(error) => {
                                let code = classify_error(&error);
                                let status = match code {
                                    "PORTABLE_RUNTIME_TIMEOUT" => "timed-out",
                                    "JOB_CANCELLED" => "cancelled",
                                    _ => "failed",
                                };
                                (status, None, Some(RunnerError {
                                    code: code.into(), message: format!("{error:#}"),
                                }))
                            }
                        };
                        runtime.block_on(task_context.clear_host_calls());
                        runtime.block_on(task_context.terminal(status, result, error));
                        let _ = task_complete_tx.send(task_context.job_id.clone());
                    });
                    jobs.lock().await.insert(job_id.clone(), ActiveJob {
                        context,
                    });
                    let _ = output_tx.send(RunnerOutput::Response { response: RunnerResponse {
                        request_id: request.request_id, protocol_version: RUNNER_PROTOCOL_VERSION,
                        ok: true, result: Some(json!({ "jobId": job_id })), error: None,
                    }}).await;
                }
                RunnerOperation::CancelJob => {
                    let job_id = request.job_id.clone().unwrap_or_default();
                    let active = jobs.lock().await.remove(&job_id);
                    let response = if let Some(active) = active {
                        active.context.cancelled.store(true, Ordering::Relaxed);
                        active.context.cancel_notify.notify_waiters();
                        active.context.clear_host_calls().await;
                        let timed_out = request.cancel_reason.as_deref() == Some("timeout");
                        active.context.terminal(
                            if timed_out { "timed-out" } else { "cancelled" },
                            None,
                            Some(RunnerError {
                                code: if timed_out { "PORTABLE_RUNTIME_TIMEOUT" } else { "JOB_CANCELLED" }.into(),
                                message: if timed_out {
                                    "Job execution exceeded the caller timeout.".into()
                                } else {
                                    "Job cancellation was requested by the host.".into()
                                },
                            }),
                        ).await;
                        response_for(request.request_id, Ok(json!({ "jobId": job_id, "cancelRequested": true })))
                    } else {
                        response_for(request.request_id, Err(anyhow!("JOB_NOT_FOUND: {job_id}")))
                    };
                    let _ = output_tx.send(RunnerOutput::Response { response }).await;
                }
                RunnerOperation::JobStatus => {
                    let job_id = request.job_id.clone().unwrap_or_default();
                    let active = jobs.lock().await.contains_key(&job_id);
                    let _ = output_tx.send(RunnerOutput::Response { response: response_for(
                        request.request_id, Ok(json!({ "jobId": job_id, "active": active })),
                    ) }).await;
                }
                RunnerOperation::ResolveHostCall => {
                    let host_call_id = request.host_call_id.clone().unwrap_or_default();
                    let resolution = match request.host_call_error.clone() {
                        Some(error) => HostCallResolution {
                            result: Err(format!("{}: {}", error.code, error.message)),
                        },
                        None => match request.host_call_result.clone() {
                            Some(result) => match serde_json::to_vec(&result) {
                                Ok(bytes) if bytes.len() <= MAX_HOST_CALL_BYTES => {
                                    HostCallResolution { result: Ok(result) }
                                }
                                Ok(_) => HostCallResolution {
                                    result: Err("HOST_CALL_OUTPUT_TOO_LARGE: host callback output exceeds 64 KiB".into()),
                                },
                                Err(error) => HostCallResolution {
                                    result: Err(format!("HOST_CALL_OUTPUT_INVALID: {error}")),
                                },
                            },
                            None => HostCallResolution {
                                result: Err("HOST_CALL_FAILED: host callback returned no result".into()),
                            },
                        },
                    };
                    let response = if let Some(pending) = host_calls.lock().await.remove(&host_call_id) {
                        let _ = pending.reply.send(resolution);
                        response_for(request.request_id, Ok(json!({
                            "hostCallId": host_call_id,
                            "resolved": true,
                        })))
                    } else {
                        response_for(request.request_id, Err(anyhow!("HOST_CALL_NOT_FOUND: {host_call_id}")))
                    };
                    let _ = output_tx.send(RunnerOutput::Response { response }).await;
                }
                _ => {
                    let task_runner = Rc::clone(&runner);
                    let task_output = output_tx.clone();
                    tokio::task::spawn_local(async move {
                        let request_id = request.request_id.clone();
                        let response = response_for(request_id, task_runner.lock().await.handle(&request).await);
                        let _ = task_output.send(RunnerOutput::Response { response }).await;
                    });
                }
            }
        }
                Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::{
        RunnerApp, RunnerFileMount, app_key, assert_safe_guest_path, classify_error,
        migrate_legacy_json_kv, open_portable_kv_database, spin_allowed_hosts,
    };
    use std::{collections::BTreeMap, fs, path::PathBuf};

    #[test]
    fn classifies_public_wasi_failures() {
        for (message, expected) in [
            (
                "CAPABILITY_DENIED: storage permission is required",
                "WASI_CAPABILITY_DENIED",
            ),
            (
                "INVALID_INPUT: expected an object",
                "WASI_INPUT_SCHEMA_MISMATCH",
            ),
            (
                "missing export nextclaw:service",
                "WASI_GUEST_EXPORT_MISSING",
            ),
            ("component type mismatch", "WASI_ABI_VERSION_MISMATCH"),
            ("guest trapped: unreachable", "WASI_COMPONENT_TRAP"),
            (
                "guest returned an application error",
                "WASI_COMPONENT_FAILED",
            ),
        ] {
            assert_eq!(classify_error(&anyhow::anyhow!(message)), expected);
        }
    }

    #[test]
    fn isolates_cached_factor_configuration() {
        let base = RunnerApp {
            id: "example".into(),
            component_path: PathBuf::from("service.wasm"),
            data_directory: PathBuf::from("instance-a"),
            allowed_domains: vec!["example.com".into()],
            allowed_provider_ids: vec!["provider-a".into()],
            storage_enabled: true,
            file_mounts: vec![RunnerFileMount {
                host_path: PathBuf::from("documents"),
                guest_path: "/documents/notes".into(),
                writable: false,
            }],
            secret_variables: BTreeMap::from([(
                "nextclaw_secret_6170692d746f6b656e".into(),
                "top-secret".into(),
            )]),
            secret_fingerprints: BTreeMap::from([("api-token".into(), "digest-a".into())]),
        };
        let mut changed = base.clone();
        changed.storage_enabled = false;
        assert_ne!(app_key(&base), app_key(&changed));

        changed = base.clone();
        changed.data_directory = PathBuf::from("instance-b");
        assert_ne!(app_key(&base), app_key(&changed));

        changed = base.clone();
        changed.file_mounts[0].writable = true;
        assert_ne!(app_key(&base), app_key(&changed));

        changed = base.clone();
        changed
            .secret_variables
            .insert("api-token".into(), "rotated".into());
        assert_eq!(app_key(&base), app_key(&changed));

        changed
            .secret_fingerprints
            .insert("api-token".into(), "digest-b".into());
        assert_ne!(app_key(&base), app_key(&changed));
    }

    #[test]
    fn accepts_only_absolute_contained_guest_paths() {
        assert_safe_guest_path("/app").unwrap();
        assert_safe_guest_path("/documents/notes").unwrap();
        for path in ["relative", "/documents/../outside", "/documents/./notes"] {
            assert!(
                assert_safe_guest_path(path).is_err(),
                "{path} must be rejected"
            );
        }
    }

    #[test]
    fn maps_domains_to_https_only_spin_policy() {
        assert_eq!(
            spin_allowed_hosts(&["api.example.com".into()]).unwrap(),
            vec![
                "https://*.api.example.com".to_string(),
                "https://api.example.com".to_string(),
            ],
        );
        for invalid in ["http://example.com", "example.com:443", "example.com/path"] {
            assert!(spin_allowed_hosts(&[invalid.into()]).is_err(), "{invalid}");
        }
    }

    #[test]
    fn migrates_legacy_json_to_spin_kv_sqlite_without_data_loss() {
        let directory = tempfile::tempdir().unwrap();
        let legacy_path = directory.path().join("portable-kv.json");
        fs::write(&legacy_path, r#"{"counter":"7","note":"preserve me"}"#).unwrap();

        migrate_legacy_json_kv(&directory.path().to_path_buf()).unwrap();

        assert!(!legacy_path.exists());
        assert!(directory.path().join("portable-kv.legacy.json").exists());
        let connection =
            open_portable_kv_database(&directory.path().join("portable-kv.sqlite")).unwrap();
        let counter: Vec<u8> = connection
            .query_row(
                "SELECT value FROM spin_key_value WHERE store = ?1 AND key = ?2",
                rusqlite::params!["default", "counter"],
                |row| row.get(0),
            )
            .unwrap();
        let note: Vec<u8> = connection
            .query_row(
                "SELECT value FROM spin_key_value WHERE store = ?1 AND key = ?2",
                rusqlite::params!["default", "note"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(counter, b"7");
        assert_eq!(note, b"preserve me");
    }
}
