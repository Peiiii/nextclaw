#[allow(warnings)]
mod bindings;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const STATE_KEY: &str = "verification.resident.v1";
const RECENT_EVENT_LIMIT: usize = 12;
static STARTED: AtomicBool = AtomicBool::new(false);
static IN_MEMORY_EVENT_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResidentEvent {
    event_id: String,
    kind: String,
    triggered_at: String,
}

#[derive(Default, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResidentState {
    instance_epoch: u64,
    event_count: u64,
    last_event_id: Option<String>,
    last_event_kind: Option<String>,
    last_triggered_at: Option<String>,
    stopped_at: Option<String>,
    recent_events: Vec<ResidentEvent>,
}

struct ResidentLab;

impl Guest for ResidentLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "resident_status".into(),
                title: "读取 Resident 状态".into(),
                description: "读取同一常驻 WASM 实例的内存计数、durable cursor 与最近事件。".into(),
            },
            Action {
                name: "resident_emit_event".into(),
                title: "向 Resident 投递事件".into(),
                description: "通过宿主保留的同一实例投递一条手动事件。".into(),
            },
            Action {
                name: "resident_reset".into(),
                title: "重置 Resident 证据".into(),
                description: "清空持久事件计数和最近事件，同时保留当前实例代次。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看 Resident 宿主".into(),
                description: "返回共享 runner 进程与当前 Resident component 信息。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(
            host::LogLevel::Info,
            &format!("resident-lab invoking {action}"),
        );
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "resident_status" => status_json(&read_state()?),
            "resident_emit_event" => {
                let state = read_state()?;
                let event = ResidentEvent {
                    event_id: input
                        .get("eventId")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("manual-{}", state.event_count + 1)),
                    kind: input
                        .get("kind")
                        .and_then(Value::as_str)
                        .unwrap_or("manual")
                        .to_string(),
                    triggered_at: input
                        .get("triggeredAt")
                        .and_then(Value::as_str)
                        .unwrap_or("manual")
                        .to_string(),
                };
                handle_resident_event(event)
            }
            "resident_reset" => {
                let mut state = read_state()?;
                state.event_count = 0;
                state.last_event_id = None;
                state.last_event_kind = None;
                state.last_triggered_at = None;
                state.recent_events.clear();
                IN_MEMORY_EVENT_COUNT.store(0, Ordering::Relaxed);
                write_state(&state)?;
                status_json(&state)
            }
            "runtime_info" => {
                let info = host::get_runtime_info();
                Ok(json!({
                    "runnerPid": info.runner_pid,
                    "loadedComponents": info.loaded_components,
                    "componentId": info.component_id,
                    "residentInstance": STARTED.load(Ordering::Relaxed)
                })
                .to_string())
            }
            _ => Err(format!("unknown resident action: {action}")),
        }
    }

    fn start(config_json: String) -> Result<String, String> {
        let config: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
        let mut state = read_state()?;
        state.instance_epoch = state.instance_epoch.saturating_add(1);
        state.stopped_at = None;
        STARTED.store(true, Ordering::Relaxed);
        IN_MEMORY_EVENT_COUNT.store(0, Ordering::Relaxed);
        write_state(&state)?;
        host::log(
            host::LogLevel::Info,
            &format!(
                "resident-lab started epoch={} intervalMs={}",
                state.instance_epoch,
                config
                    .get("eventIntervalMs")
                    .and_then(Value::as_u64)
                    .unwrap_or(0),
            ),
        );
        status_json(&state)
    }

    fn handle_event(event_json: String) -> Result<String, String> {
        if !STARTED.load(Ordering::Relaxed) {
            return Err("RESIDENT_NOT_STARTED: start must run before event delivery".into());
        }
        let event = serde_json::from_str::<ResidentEvent>(&event_json)
            .map_err(|error| format!("INVALID_RESIDENT_EVENT: {error}"))?;
        handle_resident_event(event)
    }

    fn stop(reason_json: String) -> Result<String, String> {
        let reason: Value = serde_json::from_str(&reason_json).unwrap_or_else(|_| json!({}));
        let mut state = read_state()?;
        state.stopped_at = reason
            .get("stoppedAt")
            .and_then(Value::as_str)
            .map(str::to_string);
        STARTED.store(false, Ordering::Relaxed);
        write_state(&state)?;
        status_json(&state)
    }
}

fn handle_resident_event(event: ResidentEvent) -> Result<String, String> {
    let mut state = read_state()?;
    state.event_count = state.event_count.saturating_add(1);
    state.last_event_id = Some(event.event_id.clone());
    state.last_event_kind = Some(event.kind.clone());
    state.last_triggered_at = Some(event.triggered_at.clone());
    state.recent_events.push(event);
    if state.recent_events.len() > RECENT_EVENT_LIMIT {
        state.recent_events.remove(0);
    }
    IN_MEMORY_EVENT_COUNT.fetch_add(1, Ordering::Relaxed);
    write_state(&state)?;
    status_json(&state)
}

fn read_state() -> Result<ResidentState, String> {
    match host::kv_get(STATE_KEY)? {
        Some(value) => {
            serde_json::from_str(&value).map_err(|error| format!("INVALID_RESIDENT_STATE: {error}"))
        }
        None => Ok(ResidentState::default()),
    }
}

fn write_state(state: &ResidentState) -> Result<(), String> {
    host::kv_set(
        STATE_KEY,
        &serde_json::to_string(state).map_err(|error| error.to_string())?,
    )
}

fn status_json(state: &ResidentState) -> Result<String, String> {
    Ok(json!({
        "started": STARTED.load(Ordering::Relaxed),
        "instanceEpoch": state.instance_epoch,
        "inMemoryEventCount": IN_MEMORY_EVENT_COUNT.load(Ordering::Relaxed),
        "eventCount": state.event_count,
        "lastEventId": state.last_event_id,
        "lastEventKind": state.last_event_kind,
        "lastTriggeredAt": state.last_triggered_at,
        "stoppedAt": state.stopped_at,
        "recentEvents": state.recent_events,
        "persistedBy": "host.kv"
    })
    .to_string())
}

bindings::export!(ResidentLab with_types_in bindings);
