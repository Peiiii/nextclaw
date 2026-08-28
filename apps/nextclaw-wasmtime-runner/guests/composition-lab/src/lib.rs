#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use serde_json::{Value, json};

const PROVIDER_ID: &str = "nextclaw-portable-runtime-lab-provider";

struct CompositionLab;

impl Guest for CompositionLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "compose_contact".into(),
                title: "组合联系人工作流".into(),
                description: "Consumer 通过宿主调用 manifest 声明的 Provider，再组合结果。".into(),
            },
            Action {
                name: "provider_denied".into(),
                title: "验证 Provider 拒绝".into(),
                description: "尝试调用未声明 Provider，观察宿主的确定性拒绝。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看 Consumer 宿主".into(),
                description: "返回 Consumer 所在共享 runner 信息。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(
            host::LogLevel::Info,
            &format!("composition-lab invoking {action}"),
        );
        match action.as_str() {
            "compose_contact" => {
                let provider_output =
                    host::component_call(PROVIDER_ID, "contact_normalize", &input_json)?;
                let provider: Value = serde_json::from_str(&provider_output)
                    .map_err(|error| format!("INVALID_PROVIDER_OUTPUT: {error}"))?;
                let display_label = format!(
                    "{} <{}>",
                    provider
                        .get("normalizedName")
                        .and_then(Value::as_str)
                        .unwrap_or(""),
                    provider
                        .get("normalizedEmail")
                        .and_then(Value::as_str)
                        .unwrap_or(""),
                );
                Ok(json!({
                    "displayLabel": display_label,
                    "provider": provider,
                    "consumerId": "nextclaw-portable-runtime-lab-composition",
                    "mediatedBy": "host.component-call"
                })
                .to_string())
            }
            "provider_denied" => {
                match host::component_call("undeclared-provider", "anything", "{}") {
                    Ok(_) => Err("provider policy unexpectedly allowed undeclared provider".into()),
                    Err(reason) => Ok(json!({
                        "denied": true,
                        "reason": reason,
                        "mediatedBy": "host.component-call"
                    })
                    .to_string()),
                }
            }
            "runtime_info" => {
                let info = host::get_runtime_info();
                Ok(json!({
                    "runnerPid": info.runner_pid,
                    "loadedComponents": info.loaded_components,
                    "componentId": info.component_id
                })
                .to_string())
            }
            _ => Err(format!("unknown composition action: {action}")),
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

bindings::export!(CompositionLab with_types_in bindings);
