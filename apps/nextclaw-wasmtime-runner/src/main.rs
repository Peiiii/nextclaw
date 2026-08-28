use std::collections::HashMap;
use std::fs;
use std::io::{self, BufRead, Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use url::Url;
use wasmtime::component::ResourceTable;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxView, WasiView};

wasmtime::component::bindgen!({
    path: "wit",
    world: "service-app",
});

use exports::nextclaw::portable_service::service::Action;
use nextclaw::portable_service::host::{
    Host, HttpResponse, LogLevel, RuntimeInfo as GuestRuntimeInfo,
};

const MAX_HTTP_BODY_BYTES: usize = 64 * 1024;
const RUNNER_PROTOCOL_VERSION: &str = "0.1.0";

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
    StartProvider,
    StartResident,
    DeliverEvent,
    Stats,
    Stop,
}

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

struct HostState {
    app: RunnerApp,
    loaded_components: u32,
    providers: ProviderRegistry,
    wasi: WasiCtx,
    table: ResourceTable,
}

struct Runner {
    engine: Engine,
    linker: Linker<HostState>,
    components: HashMap<PathBuf, Component>,
    providers: ProviderRegistry,
    residents: HashMap<String, ResidentInstance>,
}

type ProviderRegistry = Arc<Mutex<HashMap<String, ProviderInstance>>>;

struct ProviderInstance {
    bindings: ServiceApp,
    store: Store<HostState>,
}

struct ResidentInstance {
    bindings: ServiceApp,
    store: Store<HostState>,
}

impl Runner {
    fn new() -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model(true);
        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);
        nextclaw::portable_service::host::add_to_linker::<
            HostState,
            wasmtime::component::HasSelf<HostState>,
        >(&mut linker, |state| state)?;
        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        let providers = Arc::new(Mutex::new(HashMap::new()));
        Ok(Self {
            engine,
            linker,
            components: HashMap::new(),
            providers,
            residents: HashMap::new(),
        })
    }

    fn handle(&mut self, request: &RunnerRequest) -> Result<Value> {
        match request.operation {
            RunnerOperation::ListActions => self.list_actions(require_app(request)?),
            RunnerOperation::Invoke => self.invoke(
                require_app(request)?,
                request
                    .action_name
                    .as_deref()
                    .context("actionName is required")?,
                request.input.clone().unwrap_or_else(|| json!({})),
            ),
            RunnerOperation::StartProvider => self.start_provider(
                require_app(request)?,
                request.input.clone().unwrap_or_else(|| json!({})),
            ),
            RunnerOperation::StartResident => self.start_resident(
                require_app(request)?,
                request.input.clone().unwrap_or_else(|| json!({})),
            ),
            RunnerOperation::DeliverEvent => self.deliver_event(
                require_app(request)?,
                request.input.clone().unwrap_or_else(|| json!({})),
            ),
            RunnerOperation::Stats => Ok(json!({
                "runnerPid": std::process::id(),
                "loadedComponents": self.components.len(),
                "providerInstances": self.provider_count()?,
                "residentInstances": self.residents.len(),
            })),
            RunnerOperation::Stop => {
                if let Some(app) = &request.app {
                    self.stop_resident(app, request.input.clone().unwrap_or_else(|| json!({})))?;
                    self.stop_provider(app, request.input.clone().unwrap_or_else(|| json!({})))?;
                    self.components.remove(&app.component_path);
                }
                Ok(json!({ "stopped": true }))
            }
        }
    }

    fn list_actions(&mut self, app: &RunnerApp) -> Result<Value> {
        if let Some(actions) = self.provider_actions(&app.id)? {
            return serialize_actions(&actions);
        }
        if let Some(resident) = self.residents.get_mut(&app.id) {
            let actions = resident
                .bindings
                .nextclaw_portable_service_service()
                .call_list_actions(&mut resident.store)?;
            return serialize_actions(&actions);
        }
        let component = self.component(app)?.clone();
        let mut store = self.instantiate_store(app)?;
        let bindings = ServiceApp::instantiate(&mut store, &component, &self.linker)?;
        let actions = bindings
            .nextclaw_portable_service_service()
            .call_list_actions(&mut store)?;
        serialize_actions(&actions)
    }

    fn invoke(&mut self, app: &RunnerApp, action_name: &str, input: Value) -> Result<Value> {
        if let Some(output) = self.invoke_provider(&app.id, action_name, &input.to_string())? {
            return parse_guest_json(output);
        }
        if let Some(resident) = self.residents.get_mut(&app.id) {
            let output = resident
                .bindings
                .nextclaw_portable_service_service()
                .call_invoke(&mut resident.store, action_name, &input.to_string())?
                .map_err(|message| anyhow!(message))?;
            return parse_guest_json(output);
        }
        let component = self.component(app)?.clone();
        let mut store = self.instantiate_store(app)?;
        let bindings = ServiceApp::instantiate(&mut store, &component, &self.linker)?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut store, action_name, &input.to_string())?
            .map_err(|message| anyhow!(message))?;
        parse_guest_json(output)
    }

    fn start_provider(&mut self, app: &RunnerApp, config: Value) -> Result<Value> {
        if self.provider_exists(&app.id)? {
            return Ok(json!({ "started": false, "alreadyRunning": true }));
        }
        let component = self.component(app)?.clone();
        let mut store = self.instantiate_store(app)?;
        let bindings = ServiceApp::instantiate(&mut store, &component, &self.linker)?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_start(&mut store, &config.to_string())?
            .map_err(|message| anyhow!(message))?;
        let result = parse_guest_json(output)?;
        self.providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?
            .insert(app.id.clone(), ProviderInstance { bindings, store });
        Ok(result)
    }

    fn start_resident(&mut self, app: &RunnerApp, config: Value) -> Result<Value> {
        if self.residents.contains_key(&app.id) {
            return Ok(json!({ "started": false, "alreadyRunning": true }));
        }
        let component = self.component(app)?.clone();
        let mut store = self.instantiate_store(app)?;
        let bindings = ServiceApp::instantiate(&mut store, &component, &self.linker)?;
        let output = bindings
            .nextclaw_portable_service_service()
            .call_start(&mut store, &config.to_string())?
            .map_err(|message| anyhow!(message))?;
        let result = parse_guest_json(output)?;
        self.residents
            .insert(app.id.clone(), ResidentInstance { bindings, store });
        Ok(result)
    }

    fn deliver_event(&mut self, app: &RunnerApp, event: Value) -> Result<Value> {
        let resident = self
            .residents
            .get_mut(&app.id)
            .with_context(|| format!("resident instance {} is not running", app.id))?;
        let output = resident
            .bindings
            .nextclaw_portable_service_service()
            .call_handle_event(&mut resident.store, &event.to_string())?
            .map_err(|message| anyhow!(message))?;
        parse_guest_json(output)
    }

    fn stop_resident(&mut self, app: &RunnerApp, reason: Value) -> Result<()> {
        let Some(mut resident) = self.residents.remove(&app.id) else {
            return Ok(());
        };
        resident
            .bindings
            .nextclaw_portable_service_service()
            .call_stop(&mut resident.store, &reason.to_string())?
            .map_err(|message| anyhow!(message))?;
        Ok(())
    }

    fn stop_provider(&mut self, app: &RunnerApp, reason: Value) -> Result<()> {
        let provider = self
            .providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?
            .remove(&app.id);
        let Some(mut provider) = provider else {
            return Ok(());
        };
        provider
            .bindings
            .nextclaw_portable_service_service()
            .call_stop(&mut provider.store, &reason.to_string())?
            .map_err(|message| anyhow!(message))?;
        Ok(())
    }

    fn provider_exists(&self, app_id: &str) -> Result<bool> {
        Ok(self
            .providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?
            .contains_key(app_id))
    }

    fn provider_count(&self) -> Result<usize> {
        Ok(self
            .providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?
            .len())
    }

    fn provider_actions(&self, app_id: &str) -> Result<Option<Vec<Action>>> {
        let mut providers = self
            .providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?;
        let Some(provider) = providers.get_mut(app_id) else {
            return Ok(None);
        };
        let actions = provider
            .bindings
            .nextclaw_portable_service_service()
            .call_list_actions(&mut provider.store)?;
        Ok(Some(actions))
    }

    fn invoke_provider(
        &self,
        app_id: &str,
        action_name: &str,
        input_json: &str,
    ) -> Result<Option<String>> {
        let mut providers = self
            .providers
            .lock()
            .map_err(|_| anyhow!("provider registry lock was poisoned"))?;
        let Some(provider) = providers.get_mut(app_id) else {
            return Ok(None);
        };
        let output = provider
            .bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut provider.store, action_name, input_json)?
            .map_err(|message| anyhow!(message))?;
        Ok(Some(output))
    }

    fn instantiate_store(&self, app: &RunnerApp) -> Result<Store<HostState>> {
        fs::create_dir_all(&app.data_directory).with_context(|| {
            format!(
                "failed to create data directory {}",
                app.data_directory.display()
            )
        })?;
        Ok(Store::new(
            &self.engine,
            HostState {
                app: app.clone(),
                loaded_components: self.components.len() as u32,
                providers: Arc::clone(&self.providers),
                wasi: WasiCtx::builder().build(),
                table: ResourceTable::new(),
            },
        ))
    }

    fn component(&mut self, app: &RunnerApp) -> Result<&Component> {
        if !self.components.contains_key(&app.component_path) {
            let component =
                Component::from_file(&self.engine, &app.component_path).map_err(|error| {
                    anyhow!(
                        "failed to load component {}: {error}",
                        app.component_path.display(),
                    )
                })?;
            self.components
                .insert(app.component_path.clone(), component);
        }
        self.components
            .get(&app.component_path)
            .context("component cache entry disappeared")
    }
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

impl Host for HostState {
    fn log(&mut self, level: LogLevel, message: String) {
        let level = match level {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        };
        eprintln!("[portable-runtime][{}][{}] {}", self.app.id, level, message);
    }

    fn kv_get(&mut self, key: String) -> std::result::Result<Option<String>, String> {
        self.assert_storage_enabled()?;
        self.read_kv().map(|values| values.get(&key).cloned())
    }

    fn kv_set(&mut self, key: String, value: String) -> std::result::Result<(), String> {
        self.assert_storage_enabled()?;
        (|| {
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
        })()
    }

    fn http_get(&mut self, raw_url: String) -> std::result::Result<HttpResponse, String> {
        (|| {
            let url = Url::parse(&raw_url).map_err(to_string)?;
            if url.scheme() != "https" {
                return Err("NETWORK_DENIED: only https URLs are allowed".into());
            }
            let host = url
                .host_str()
                .ok_or_else(|| "NETWORK_DENIED: URL has no host".to_string())?;
            let allowed = self
                .app
                .allowed_domains
                .iter()
                .any(|domain| host == domain || host.ends_with(&format!(".{domain}")));
            if !allowed {
                return Err(format!("NETWORK_DENIED: {host} is not in allowedDomains"));
            }
            let response = reqwest::blocking::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .map_err(to_string)?
                .get(url)
                .send()
                .map_err(to_string)?;
            let status = response.status().as_u16();
            let mut bytes = Vec::with_capacity(MAX_HTTP_BODY_BYTES + 1);
            response
                .take((MAX_HTTP_BODY_BYTES + 1) as u64)
                .read_to_end(&mut bytes)
                .map_err(to_string)?;
            if bytes.len() > MAX_HTTP_BODY_BYTES {
                return Err(format!("HTTP_BODY_TOO_LARGE: {} bytes", bytes.len()));
            }
            Ok(HttpResponse {
                status,
                body: String::from_utf8_lossy(&bytes).into_owned(),
            })
        })()
    }

    fn component_call(
        &mut self,
        provider_id: String,
        action: String,
        input_json: String,
    ) -> std::result::Result<String, String> {
        if !self.app.allowed_provider_ids.contains(&provider_id) {
            return Err(format!(
                "PROVIDER_DENIED: {} did not declare provider {}",
                self.app.id, provider_id,
            ));
        }
        let mut providers = self
            .providers
            .lock()
            .map_err(|_| "PROVIDER_REGISTRY_FAILED: lock was poisoned".to_string())?;
        let provider = providers
            .get_mut(&provider_id)
            .ok_or_else(|| format!("PROVIDER_NOT_RUNNING: {provider_id}"))?;
        provider
            .bindings
            .nextclaw_portable_service_service()
            .call_invoke(&mut provider.store, &action, &input_json)
            .map_err(to_string)?
    }

    fn get_runtime_info(&mut self) -> GuestRuntimeInfo {
        GuestRuntimeInfo {
            runner_pid: std::process::id(),
            loaded_components: self.loaded_components,
            component_id: self.app.id.clone(),
        }
    }
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi,
            table: &mut self.table,
        }
    }
}

impl HostState {
    fn assert_storage_enabled(&self) -> std::result::Result<(), String> {
        if self.app.storage_enabled {
            Ok(())
        } else {
            Err("CAPABILITY_DENIED: storage permission is required".into())
        }
    }

    fn kv_path(&self) -> PathBuf {
        self.app.data_directory.join("portable-kv.json")
    }

    fn read_kv(&self) -> Result<HashMap<String, String>, String> {
        let path = self.kv_path();
        if !path.exists() {
            return Ok(HashMap::new());
        }
        serde_json::from_slice(&fs::read(path).map_err(to_string)?).map_err(to_string)
    }
}

fn require_app(request: &RunnerRequest) -> Result<&RunnerApp> {
    request.app.as_ref().context("app is required")
}

fn assert_safe_key(key: &str) -> Result<(), String> {
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
                code: "PORTABLE_RUNTIME_FAILED".into(),
                message: format!("{error:#}"),
            }),
        },
    }
}

fn main() -> Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    let mut runner = Runner::new()?;
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<RunnerRequest>(&line) {
            Ok(request) => response_for(request.request_id.clone(), runner.handle(&request)),
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
