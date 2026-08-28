#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use serde_json::{Value, json};

struct CapabilityLab;

impl Guest for CapabilityLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "network_allowed".into(),
                title: "访问允许的网络".into(),
                description: "通过宿主 HTTP 原语访问 manifest 白名单中的地址。".into(),
            },
            Action {
                name: "network_denied".into(),
                title: "验证网络拒绝".into(),
                description: "尝试访问未声明域名，展示宿主拒绝结果。".into(),
            },
            Action {
                name: "structured_failure".into(),
                title: "触发结构化失败".into(),
                description: "由 Guest 主动返回可诊断错误。".into(),
            },
            Action {
                name: "simulate_timeout".into(),
                title: "触发执行超时".into(),
                description: "执行超预算计算，验证宿主超时与 runner 恢复。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看共享宿主".into(),
                description: "返回与另一个 component 相同的 runner 进程信息。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(
            host::LogLevel::Info,
            &format!("capability-lab invoking {action}"),
        );
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "network_allowed" => {
                let url = input
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("https://httpbin.org/json");
                let response = host::http_get(url)?;
                Ok(json!({
                    "url": url,
                    "status": response.status,
                    "bodyPreview": response.body.chars().take(240).collect::<String>(),
                    "mediatedBy": "host.http"
                })
                .to_string())
            }
            "network_denied" => {
                let url = "https://example.com/";
                match host::http_get(url) {
                    Ok(_) => Err("network policy unexpectedly allowed example.com".into()),
                    Err(message) => Ok(json!({
                        "url": url,
                        "denied": true,
                        "reason": message,
                        "mediatedBy": "host.http"
                    })
                    .to_string()),
                }
            }
            "structured_failure" => {
                Err("DEMO_GUEST_FAILURE: Rust component returned a deliberate error".into())
            }
            "simulate_timeout" => {
                let mut value: u64 = 1;
                loop {
                    value = value.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                    std::hint::black_box(value);
                }
            }
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
            _ => Err(format!("unknown capability action: {action}")),
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

bindings::export!(CapabilityLab with_types_in bindings);
