#[allow(warnings)]
mod bindings;

use std::sync::atomic::{AtomicBool, Ordering};

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use serde_json::{Value, json};

const CALL_COUNT_KEY: &str = "verification.provider.call-count.v1";
static STARTED: AtomicBool = AtomicBool::new(false);

struct ProviderLab;

impl Guest for ProviderLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "contact_normalize".into(),
                title: "规范化联系人".into(),
                description: "以稳定 Provider 合同规范化姓名、邮箱和标签。".into(),
            },
            Action {
                name: "provider_status".into(),
                title: "读取 Provider 状态".into(),
                description: "返回注册状态和累计调用数。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看 Provider 宿主".into(),
                description: "返回共享 runner 与 Provider component 信息。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(
            host::LogLevel::Info,
            &format!("provider-lab invoking {action}"),
        );
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "contact_normalize" => {
                if !STARTED.load(Ordering::Relaxed) {
                    return Err("PROVIDER_NOT_STARTED: provider lifecycle has not started".into());
                }
                let name = input
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                let email = input
                    .get("email")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim()
                    .to_ascii_lowercase();
                if name.is_empty() || !email.contains('@') {
                    return Err("INVALID_CONTACT: name and valid email are required".into());
                }
                let mut tags = input
                    .get("tags")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(|tag| tag.trim().to_ascii_lowercase())
                    .filter(|tag| !tag.is_empty())
                    .collect::<Vec<_>>();
                tags.sort();
                tags.dedup();
                let call_count = read_call_count()?.saturating_add(1);
                host::kv_set(CALL_COUNT_KEY, &call_count.to_string())?;
                Ok(json!({
                    "normalizedName": name,
                    "normalizedEmail": email,
                    "normalizedTags": tags,
                    "providerId": "nextclaw-portable-runtime-lab-provider",
                    "providerCallCount": call_count
                })
                .to_string())
            }
            "provider_status" => Ok(json!({
                "started": STARTED.load(Ordering::Relaxed),
                "providerCallCount": read_call_count()?,
                "persistedBy": "host.kv"
            })
            .to_string()),
            "runtime_info" => {
                let info = host::get_runtime_info();
                Ok(json!({
                    "runnerPid": info.runner_pid,
                    "loadedComponents": info.loaded_components,
                    "componentId": info.component_id,
                    "providerInstance": STARTED.load(Ordering::Relaxed)
                })
                .to_string())
            }
            _ => Err(format!("unknown provider action: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> {
        STARTED.store(true, Ordering::Relaxed);
        Ok(json!({
            "started": true,
            "mode": "provider",
            "providerCallCount": read_call_count()?
        })
        .to_string())
    }

    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("UNSUPPORTED_LIFECYCLE: provider does not accept resident events".into())
    }

    fn stop(_reason_json: String) -> Result<String, String> {
        STARTED.store(false, Ordering::Relaxed);
        Ok(json!({ "stopped": true, "mode": "provider" }).to_string())
    }
}

fn read_call_count() -> Result<u64, String> {
    Ok(host::kv_get(CALL_COUNT_KEY)?
        .and_then(|value| value.parse().ok())
        .unwrap_or(0))
}

bindings::export!(ProviderLab with_types_in bindings);
