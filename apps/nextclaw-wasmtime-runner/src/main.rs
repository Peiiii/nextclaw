use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use spin_app::{App, AppComponent, locked::LockedApp};
use spin_core::{Component, async_trait};
use spin_factor_wasi::{DummyFilesMounter, WasiFactor};
use spin_factors::{
    ConfigureAppContext, Factor, FactorData, InitContext, PrepareContext, RuntimeFactors,
    SelfInstanceBuilder,
};
use spin_factors_executor::{ComponentLoader, FactorsExecutor, FactorsExecutorApp};
use tokio::sync::Mutex;
use url::Url;

wasmtime::component::bindgen!({
    path: "wit",
    world: "service-app",
    imports: { default: async },
    exports: { default: async },
});

use exports::nextclaw::portable_service::service::Action;
use nextclaw::portable_service::host::{
    Host, HttpResponse, LogLevel, RuntimeInfo as GuestRuntimeInfo,
};

const MAX_HTTP_BODY_BYTES: usize = 64 * 1024;
const RUNNER_PROTOCOL_VERSION: &str = "0.1.0";

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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunnerRequest {
    request_id: String,
    operation: RunnerOperation,
    app: Option<RunnerApp>,
    action_name: Option<String>,
    input: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum RunnerOperation {
    ListActions,
    Invoke,
    Stats,
    Stop,
    StartProvider,
    StartResident,
    DeliverEvent,
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

#[derive(Debug, Serialize)]
struct RunnerError {
    code: String,
    message: String,
}

#[derive(Clone)]
struct NextClawFactorConfig {
    app: RunnerApp,
    loaded_components: u32,
    providers: ProviderRegistry,
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
    nextclaw: NextClawFactor,
}

type LoadedSpinApp = FactorsExecutorApp<SpinFactors, ()>;
type SpinStore =
    spin_core::Store<spin_factors_executor::InstanceState<SpinFactorsInstanceState, ()>>;

struct ActiveInstance {
    bindings: ServiceApp,
    store: SpinStore,
}

type ProviderRegistry = Arc<Mutex<HashMap<String, ActiveInstance>>>;

struct PathComponentLoader {
    component_path: PathBuf,
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
    residents: HashMap<String, ActiveInstance>,
}

impl Runner {
    fn new() -> Result<Self> {
        let factors = SpinFactors {
            wasi: WasiFactor::new(DummyFilesMounter),
            nextclaw: NextClawFactor,
        };
        let engine_builder = spin_core::Engine::builder(&Default::default())?;
        let executor = Arc::new(FactorsExecutor::new(engine_builder, factors)?);
        Ok(Self {
            executor,
            apps: HashMap::new(),
            providers: Arc::new(Mutex::new(HashMap::new())),
            residents: HashMap::new(),
        })
    }

    async fn handle(&mut self, request: &RunnerRequest) -> Result<Value> {
        match request.operation {
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
            let actions = resident
                .bindings
                .nextclaw_portable_service_service()
                .call_list_actions(&mut resident.store)
                .await?;
            return serialize_actions(&actions);
        }
        let (bindings, mut store) = self.instantiate(app).await?;
        let actions = bindings
            .nextclaw_portable_service_service()
            .call_list_actions(&mut store)
            .await?;
        serialize_actions(&actions)
    }

    async fn invoke(&mut self, app: &RunnerApp, action: &str, input: Value) -> Result<Value> {
        if let Some(provider) = self.providers.lock().await.get_mut(&app.id) {
            let output = provider
                .bindings
                .nextclaw_portable_service_service()
                .call_invoke(&mut provider.store, action, &input.to_string())
                .await?
                .map_err(|message| anyhow!(message))?;
            return parse_guest_json(output);
        }
        if let Some(resident) = self.residents.get_mut(&app.id) {
            let output = resident
                .bindings
                .nextclaw_portable_service_service()
                .call_invoke(&mut resident.store, action, &input.to_string())
                .await?
                .map_err(|message| anyhow!(message))?;
            return parse_guest_json(output);
        }
        let (bindings, mut store) = self.instantiate(app).await?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut store, action, &input.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
        parse_guest_json(output)
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
        let (bindings, mut store) = self.instantiate(app).await?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_start(&mut store, &config.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
        let result = parse_guest_json(output)?;
        self.residents
            .insert(app.id.clone(), ActiveInstance { bindings, store });
        Ok(result)
    }

    async fn deliver_event(&mut self, app: &RunnerApp, event: Value) -> Result<Value> {
        let resident = self
            .residents
            .get_mut(&app.id)
            .with_context(|| format!("resident instance {} is not running", app.id))?;
        let output = resident
            .bindings
            .nextclaw_portable_service_service()
            .call_handle_event(&mut resident.store, &event.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
        parse_guest_json(output)
    }

    async fn stop_resident(&mut self, app: &RunnerApp, reason: Value) -> Result<()> {
        let Some(mut resident) = self.residents.remove(&app.id) else {
            return Ok(());
        };
        resident
            .bindings
            .nextclaw_portable_service_service()
            .call_stop(&mut resident.store, &reason.to_string())
            .await?
            .map_err(|message| anyhow!(message))?;
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
        let bindings = ServiceApp::new(&mut store, &instance)?;
        Ok((bindings, store))
    }

    async fn loaded_app(&mut self, app: &RunnerApp) -> Result<&LoadedSpinApp> {
        let key = app_key(app);
        if !self.apps.contains_key(&key) {
            let locked: LockedApp = serde_json::from_value(json!({
                "spin_lock_version": 1,
                "triggers": [],
                "components": [{
                    "id": "service",
                    "source": {
                        "content_type": "application/wasm",
                        "content": {}
                    }
                }]
            }))?;
            let spin_app = App::new(format!("nextclaw:{}", app.id), locked);
            let config = SpinFactorsRuntimeConfig {
                wasi: None,
                nextclaw: Some(NextClawFactorConfig {
                    app: app.clone(),
                    loaded_components: (self.apps.len() + 1) as u32,
                    providers: Arc::clone(&self.providers),
                }),
            };
            let loaded = Arc::clone(&self.executor)
                .load_app(
                    spin_app,
                    config,
                    &PathComponentLoader {
                        component_path: app.component_path.clone(),
                    },
                    None,
                )
                .await?;
            self.apps.insert(key.clone(), loaded);
        }
        self.apps
            .get(&key)
            .context("Spin app cache entry disappeared")
    }
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
        self.read_kv().map(|values| values.get(&key).cloned())
    }

    async fn kv_set(&mut self, key: String, value: String) -> std::result::Result<(), String> {
        self.assert_storage_enabled()?;
        assert_safe_key(&key)?;
        let mut values = self.read_kv()?;
        values.insert(key, value);
        let path = self.kv_path();
        let temporary_path = path.with_extension("json.tmp");
        fs::write(
            &temporary_path,
            serde_json::to_vec_pretty(&values).map_err(to_string)?,
        )
        .map_err(to_string)?;
        fs::rename(temporary_path, path).map_err(to_string)
    }

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
}

impl NextClawFactorState {
    fn assert_storage_enabled(&self) -> std::result::Result<(), String> {
        if self.config.app.storage_enabled {
            Ok(())
        } else {
            Err("CAPABILITY_DENIED: storage permission is required".into())
        }
    }

    fn kv_path(&self) -> PathBuf {
        self.config.app.data_directory.join("portable-kv.json")
    }

    fn read_kv(&self) -> std::result::Result<HashMap<String, String>, String> {
        let path = self.kv_path();
        if !path.exists() {
            return Ok(HashMap::new());
        }
        serde_json::from_slice(&fs::read(path).map_err(to_string)?).map_err(to_string)
    }
}

fn app_key(app: &RunnerApp) -> String {
    format!(
        "{}:{}:{}:{}:{:?}:{:?}",
        app.id,
        app.component_path.display(),
        app.data_directory.display(),
        app.storage_enabled,
        app.allowed_domains,
        app.allowed_provider_ids,
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

fn to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn classify_error(error: &anyhow::Error) -> &'static str {
    let message = format!("{error:#}");
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

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let mut runner = Runner::new()?;
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout().lock();
    for line in std::io::BufRead::lines(stdin.lock()) {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<RunnerRequest>(&line) {
            Ok(request) => response_for(request.request_id.clone(), runner.handle(&request).await),
            Err(error) => RunnerResponse {
                request_id: "unknown".into(),
                protocol_version: RUNNER_PROTOCOL_VERSION,
                ok: false,
                result: None,
                error: Some(RunnerError {
                    code: "INVALID_REQUEST".into(),
                    message: error.to_string(),
                }),
            },
        };
        serde_json::to_writer(&mut stdout, &response)?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{RunnerApp, app_key, classify_error};
    use std::path::PathBuf;

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
        };
        let mut changed = base.clone();
        changed.storage_enabled = false;
        assert_ne!(app_key(&base), app_key(&changed));

        changed = base.clone();
        changed.data_directory = PathBuf::from("instance-b");
        assert_ne!(app_key(&base), app_key(&changed));
    }
}
