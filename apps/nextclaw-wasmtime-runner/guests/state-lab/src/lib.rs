#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const RECORDS_KEY: &str = "verification.records.v1";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataRecord {
    id: String,
    title: String,
    status: String,
    tags: Vec<String>,
    version: u64,
}

#[derive(Default, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataState {
    revision: u64,
    records: Vec<DataRecord>,
}

struct StateLab;

impl Guest for StateLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "counter_read".into(),
                title: "读取持久计数".into(),
                description: "从宿主管理的 KV 存储读取计数。".into(),
            },
            Action {
                name: "records_seed".into(),
                title: "生成验证数据".into(),
                description: "创建三条结构化记录，作为持久化与跨入口验证基线。".into(),
            },
            Action {
                name: "records_list".into(),
                title: "列出验证数据".into(),
                description: "返回宿主 KV 中的结构化记录、数据版本与内容校验值。".into(),
            },
            Action {
                name: "record_upsert".into(),
                title: "创建或修改记录".into(),
                description: "按 ID 创建或修改一条结构化记录，并推进数据版本。".into(),
            },
            Action {
                name: "record_delete".into(),
                title: "删除记录".into(),
                description: "删除指定结构化记录并保留可核验的数据版本。".into(),
            },
            Action {
                name: "data_snapshot".into(),
                title: "读取数据快照".into(),
                description: "返回记录数、数据版本和稳定内容校验值，用于跨重启比对。".into(),
            },
            Action {
                name: "counter_increment".into(),
                title: "增加持久计数".into(),
                description: "在 Rust/WASM 中计算，并通过宿主 KV 原语持久化。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看共享宿主".into(),
                description: "返回 runner 进程与已加载 component 数量。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(
            host::LogLevel::Info,
            &format!("state-lab invoking {action}"),
        );
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "counter_read" => {
                let value = read_counter()?;
                Ok(json!({ "counter": value, "persistedBy": "host.kv" }).to_string())
            }
            "counter_increment" => {
                let step = input.get("step").and_then(Value::as_i64).unwrap_or(1);
                let value = read_counter()?.saturating_add(step);
                host::kv_set("counter", &value.to_string())?;
                Ok(json!({ "counter": value, "step": step, "persistedBy": "host.kv" }).to_string())
            }
            "records_seed" => {
                let mut state = read_data_state()?;
                state.revision = state.revision.saturating_add(1);
                state.records = vec![
                    DataRecord {
                        id: "alpha".into(),
                        title: "验证结构化写入".into(),
                        status: "active".into(),
                        tags: vec!["data".into(), "wasm".into()],
                        version: state.revision,
                    },
                    DataRecord {
                        id: "bravo".into(),
                        title: "验证 Agent 共用 Action".into(),
                        status: "pending".into(),
                        tags: vec!["agent".into(), "action".into()],
                        version: state.revision,
                    },
                    DataRecord {
                        id: "charlie".into(),
                        title: "验证跨重启持久化".into(),
                        status: "active".into(),
                        tags: vec!["restart".into(), "evidence".into()],
                        version: state.revision,
                    },
                ];
                write_data_state(&state)?;
                Ok(data_state_json(&state).to_string())
            }
            "records_list" => Ok(data_state_json(&read_data_state()?).to_string()),
            "record_upsert" => {
                let id = required_string(&input, "id")?;
                validate_record_id(&id)?;
                let title = required_string(&input, "title")?;
                let status = input
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("active")
                    .to_string();
                let tags = input
                    .get("tags")
                    .and_then(Value::as_array)
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(Value::as_str)
                            .map(str::to_string)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                let mut state = read_data_state()?;
                state.revision = state.revision.saturating_add(1);
                let next = DataRecord {
                    id: id.clone(),
                    title,
                    status,
                    tags,
                    version: state.revision,
                };
                let created = match state.records.iter().position(|record| record.id == id) {
                    Some(index) => {
                        state.records[index] = next.clone();
                        false
                    }
                    None => {
                        state.records.push(next.clone());
                        true
                    }
                };
                write_data_state(&state)?;
                Ok(json!({
                    "created": created,
                    "record": next,
                    "snapshot": data_snapshot_json(&state),
                    "persistedBy": "host.kv"
                })
                .to_string())
            }
            "record_delete" => {
                let id = required_string(&input, "id")?;
                let mut state = read_data_state()?;
                let before = state.records.len();
                state.records.retain(|record| record.id != id);
                let deleted = state.records.len() != before;
                if deleted {
                    state.revision = state.revision.saturating_add(1);
                    write_data_state(&state)?;
                }
                Ok(json!({
                    "deleted": deleted,
                    "id": id,
                    "snapshot": data_snapshot_json(&state),
                    "persistedBy": "host.kv"
                })
                .to_string())
            }
            "data_snapshot" => Ok(json!({
                "snapshot": data_snapshot_json(&read_data_state()?),
                "persistedBy": "host.kv"
            })
            .to_string()),
            "runtime_info" => {
                let info = host::get_runtime_info();
                Ok(json!({
                    "runnerPid": info.runner_pid,
                    "loadedComponents": info.loaded_components,
                    "componentId": info.component_id,
                    "guest": "rust-component"
                })
                .to_string())
            }
            _ => Err(format!("unknown state action: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> {
        Ok(json!({ "started": true, "mode": "action" }).to_string())
    }

    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("UNSUPPORTED_LIFECYCLE: action component does not accept resident events".into())
    }

    fn stop(_reason_json: String) -> Result<String, String> {
        Ok(json!({ "stopped": true, "mode": "action" }).to_string())
    }
}

fn read_counter() -> Result<i64, String> {
    let value = host::kv_get("counter")?;
    Ok(value.and_then(|value| value.parse().ok()).unwrap_or(0))
}

fn read_data_state() -> Result<DataState, String> {
    match host::kv_get(RECORDS_KEY)? {
        Some(value) => {
            serde_json::from_str(&value).map_err(|error| format!("INVALID_DATA_STATE: {error}"))
        }
        None => Ok(DataState::default()),
    }
}

fn write_data_state(state: &DataState) -> Result<(), String> {
    let value = serde_json::to_string(state).map_err(|error| error.to_string())?;
    host::kv_set(RECORDS_KEY, &value)
}

fn data_state_json(state: &DataState) -> Value {
    let mut records = state.records.clone();
    records.sort_by(|left, right| left.id.cmp(&right.id));
    json!({
        "revision": state.revision,
        "recordCount": records.len(),
        "contentHash": content_hash(&records),
        "records": records,
        "persistedBy": "host.kv"
    })
}

fn data_snapshot_json(state: &DataState) -> Value {
    let mut records = state.records.clone();
    records.sort_by(|left, right| left.id.cmp(&right.id));
    json!({
        "revision": state.revision,
        "recordCount": records.len(),
        "contentHash": content_hash(&records)
    })
}

fn content_hash(records: &[DataRecord]) -> String {
    let bytes = serde_json::to_vec(records).unwrap_or_default();
    let hash = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    format!("fnv1a64:{hash:016x}")
}

fn required_string(input: &Value, name: &str) -> Result<String, String> {
    input
        .get(name)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("INVALID_INPUT: {name} is required"))
}

fn validate_record_id(id: &str) -> Result<(), String> {
    if id.len() <= 48
        && id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_".contains(character))
    {
        return Ok(());
    }
    Err("INVALID_INPUT: id must use 1-48 letters, digits, dash or underscore".into())
}

bindings::export!(StateLab with_types_in bindings);
