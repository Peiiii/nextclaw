#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::nextclaw::portable_service::host;
use bindings::wasi::{
    http::{
        outgoing_handler,
        types::{Fields, Method, OutgoingBody, OutgoingRequest, RequestOptions, Scheme},
    },
    io::streams::StreamError,
};
use serde_json::{Value, json};
use url::Url;

const MAX_STANDARD_HTTP_RESPONSE_BYTES: usize = 64 * 1024;
const DEFAULT_HTTP_TIMEOUT_MS: u64 = 5_000;

struct StandardHttpResponse {
    status: u16,
    body: Vec<u8>,
    location: Option<String>,
}

struct CapabilityLab;

impl Guest for CapabilityLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "network_standard_http".into(),
                title: "通过标准 WASI HTTP 访问网络".into(),
                description:
                    "使用 wasi:http/outgoing-handler 访问已授权 HTTPS 域名，并受宿主网络策略约束。"
                        .into(),
            },
            Action {
                name: "network_allowed".into(),
                title: "访问允许的网络（旧兼容接口）".into(),
                description:
                    "旧 host.http-get 兼容入口；新应用应使用标准 wasi:http/outgoing-handler。"
                        .into(),
            },
            Action {
                name: "network_denied".into(),
                title: "验证网络拒绝".into(),
                description: "使用标准 WASI HTTP 尝试访问未声明域名，展示宿主拒绝结果。".into(),
            },
            Action {
                name: "network_private_denied".into(),
                title: "验证私网拒绝".into(),
                description:
                    "使用标准 WASI HTTP 尝试访问 loopback/RFC1918 地址，展示私网保护结果。".into(),
            },
            Action {
                name: "network_redirect_denied".into(),
                title: "验证越权重定向拒绝".into(),
                description: "显式跟随一次重定向；目标域名仍须由标准 WASI HTTP 策略授权。".into(),
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
                name: "long_task".into(),
                title: "运行可观测长任务".into(),
                description: "依次报告进度和输出分块，并在安全检查点响应取消。".into(),
            },
            Action {
                name: "stream_overflow".into(),
                title: "验证流背压边界".into(),
                description: "超过单任务事件预算，验证宿主稳定终止该任务且不影响其他应用。".into(),
            },
            Action {
                name: "memory_pressure".into(),
                title: "验证内存边界".into(),
                description: "尝试超过组件内存预算，验证故障被隔离在当前任务。".into(),
            },
            Action {
                name: "runtime_info".into(),
                title: "查看共享宿主".into(),
                description: "返回与另一个 component 相同的 runner 进程信息。".into(),
            },
            Action {
                name: "filesystem_read".into(),
                title: "读取已授权文件".into(),
                description: "通过 WASI preopen 读取包资源或已授权目录中的文件。".into(),
            },
            Action {
                name: "filesystem_write".into(),
                title: "写入已授权文件".into(),
                description: "只在可写私有目录或 read-write 授权目录中创建文件。".into(),
            },
            Action {
                name: "secret_verify".into(),
                title: "验证已绑定 Secret".into(),
                description:
                    "仅通过标准 wasi:config/store 检查已绑定 slot；结果只返回脱敏布尔验证。".into(),
            },
            Action {
                name: "model_complete".into(),
                title: "调用已授权模型".into(),
                description: "通过宿主绑定的模型 slot 完成短请求；Guest 不接触提供商凭据。".into(),
            },
            Action {
                name: "agent_start".into(),
                title: "启动已授权 Agent".into(),
                description: "通过宿主绑定的 Agent slot 启动异步任务；结果回到当前 Job 事件流。"
                    .into(),
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
            "network_standard_http" => {
                let url = input
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("https://httpbin.org/json");
                let timeout_ms = input
                    .get("timeoutMs")
                    .and_then(Value::as_u64)
                    .unwrap_or(DEFAULT_HTTP_TIMEOUT_MS);
                let response_limit_bytes = input
                    .get("maxResponseBytes")
                    .and_then(Value::as_u64)
                    .and_then(|bytes| usize::try_from(bytes).ok())
                    .unwrap_or(MAX_STANDARD_HTTP_RESPONSE_BYTES)
                    .min(MAX_STANDARD_HTTP_RESPONSE_BYTES);
                if response_limit_bytes == 0 {
                    return Err("INVALID_INPUT: maxResponseBytes must be positive".into());
                }
                let response = standard_http_get(url, timeout_ms, response_limit_bytes)?;
                Ok(json!({
                    "url": url,
                    "status": response.status,
                    "bodyBytes": response.body.len(),
                    "bodyPreview": String::from_utf8_lossy(&response.body).chars().take(240).collect::<String>(),
                    "mediatedBy": "wasi:http/outgoing-handler",
                    "responseLimitBytes": response_limit_bytes,
                    "redirectLocation": response.location,
                })
                .to_string())
            }
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
                let url = input
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("https://example.com/");
                match standard_http_get(
                    url,
                    DEFAULT_HTTP_TIMEOUT_MS,
                    MAX_STANDARD_HTTP_RESPONSE_BYTES,
                ) {
                    Ok(_) => Err("network policy unexpectedly allowed example.com".into()),
                    Err(message) => Ok(json!({
                        "url": url,
                        "denied": true,
                        "reason": message,
                        "mediatedBy": "wasi:http/outgoing-handler"
                    })
                    .to_string()),
                }
            }
            "network_private_denied" => {
                let url = input
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or("https://127.0.0.1/");
                match standard_http_get(
                    url,
                    DEFAULT_HTTP_TIMEOUT_MS,
                    MAX_STANDARD_HTTP_RESPONSE_BYTES,
                ) {
                    Ok(_) => Err("network policy unexpectedly allowed private address".into()),
                    Err(message) => Ok(json!({
                        "url": url,
                        "denied": true,
                        "reason": message,
                        "mediatedBy": "wasi:http/outgoing-handler"
                    })
                    .to_string()),
                }
            }
            "network_redirect_denied" => {
                let url = input
                    .get("url")
                    .and_then(Value::as_str)
                    // A stable public-IP endpoint avoids local DNS/proxy interception in the
                    // fixture while still exercising a redirect to an unapproved DNS host.
                    .unwrap_or("https://8.8.8.8/");
                let first = standard_http_get(
                    url,
                    DEFAULT_HTTP_TIMEOUT_MS,
                    MAX_STANDARD_HTTP_RESPONSE_BYTES,
                )?;
                let location = first
                    .location
                    .ok_or("HTTP_REDIRECT_LOCATION_MISSING: expected a redirect response")?;
                let target = Url::parse(url)
                    .and_then(|base| base.join(&location))
                    .map_err(|error| format!("HTTP_REDIRECT_LOCATION_INVALID: {error}"))?;
                match standard_http_get(
                    target.as_str(),
                    DEFAULT_HTTP_TIMEOUT_MS,
                    MAX_STANDARD_HTTP_RESPONSE_BYTES,
                ) {
                    Ok(_) => Err(
                        "network policy unexpectedly followed an unapproved redirect target".into(),
                    ),
                    Err(message) => Ok(json!({
                        "initialUrl": url,
                        "initialStatus": first.status,
                        "redirectTarget": target.as_str(),
                        "denied": true,
                        "reason": message,
                        "mediatedBy": "wasi:http/outgoing-handler"
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
            "long_task" => {
                host::report_progress(Some(1), Some(2), Some("preparing"))?;
                host::emit_chunk("first chunk")?;
                if host::check_cancelled() {
                    return Err("JOB_CANCELLED: cancelled after first checkpoint".into());
                }
                host::report_progress(Some(2), Some(2), Some("finishing"))?;
                host::emit_chunk("second chunk")?;
                if host::check_cancelled() {
                    return Err("JOB_CANCELLED: cancelled before completion".into());
                }
                Ok(json!({ "completed": true, "streamed": 2 }).to_string())
            }
            "stream_overflow" => {
                for index in 0..=256 {
                    host::emit_chunk(&format!("chunk-{index}"))?;
                }
                Ok(json!({ "completed": true }).to_string())
            }
            "memory_pressure" => {
                let mut bytes = Vec::<u8>::with_capacity(80 * 1024 * 1024);
                bytes.resize(80 * 1024 * 1024, 1);
                std::hint::black_box(&bytes);
                Ok(json!({ "allocated": bytes.len() }).to_string())
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
            "filesystem_read" => {
                let path = input
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: path is required")?;
                let content = std::fs::read_to_string(path)
                    .map_err(|error| format!("FILESYSTEM_READ_FAILED: {error}"))?;
                Ok(json!({
                    "path": path,
                    "content": content,
                    "mediatedBy": "wasi.filesystem"
                })
                .to_string())
            }
            "filesystem_write" => {
                let path = input
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: path is required")?;
                let content = input
                    .get("content")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: content is required")?;
                std::fs::write(path, content)
                    .map_err(|error| format!("FILESYSTEM_WRITE_FAILED: {error}"))?;
                Ok(json!({
                    "path": path,
                    "bytes": content.len(),
                    "mediatedBy": "wasi.filesystem"
                })
                .to_string())
            }
            "secret_verify" => {
                let slot = input
                    .get("slot")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: slot is required")?;
                let expected_sha256 = input.get("expectedSha256").and_then(Value::as_str);
                let variable_name = spin_secret_variable_name(slot);
                let value = bindings::wasi::config::store::get(&variable_name)
                    .map_err(|error| format!("SECRET_READ_FAILED: {error:?}"))?
                    .ok_or_else(|| format!("SECRET_UNAVAILABLE: {slot}"))?;
                let digest = sha256_hex(&value);
                Ok(json!({
                    "available": true,
                    "matchesExpectedSha256": expected_sha256.is_some_and(|expected| expected == digest),
                    "mediatedBy": "wasi:config/store",
                })
                .to_string())
            }
            "model_complete" => {
                let slot_id = input
                    .get("slotId")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: slotId is required")?;
                let messages = input
                    .get("messages")
                    .filter(|value| value.is_array())
                    .ok_or("INVALID_INPUT: messages must be an array")?;
                let max_tokens = input
                    .get("maxTokens")
                    .and_then(Value::as_u64)
                    .and_then(|value| u32::try_from(value).ok());
                host::model_complete(&host::ModelCompleteInput {
                    slot_id: slot_id.into(),
                    messages_json: messages.to_string(),
                    max_tokens,
                })
            }
            "agent_start" => {
                let slot_id = input
                    .get("slotId")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_INPUT: slotId is required")?;
                let agent_input = input
                    .get("input")
                    .filter(|value| value.is_object())
                    .ok_or("INVALID_INPUT: input must be an object")?;
                host::agent_start(&host::AgentStartInput {
                    slot_id: slot_id.into(),
                    input_json: agent_input.to_string(),
                })
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

fn sha256_hex(value: &str) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

fn spin_secret_variable_name(slot: &str) -> String {
    format!(
        "nextclaw_secret_{}",
        slot.as_bytes()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    )
}

fn standard_http_get(
    raw_url: &str,
    timeout_ms: u64,
    response_limit_bytes: usize,
) -> Result<StandardHttpResponse, String> {
    let url =
        Url::parse(raw_url).map_err(|error| format!("INVALID_INPUT: invalid URL: {error}"))?;
    if url.scheme() != "https" {
        return Err("NETWORK_DENIED: standard HTTP requests require https".into());
    }
    let authority = url.authority().to_owned();
    if authority.is_empty() {
        return Err("INVALID_INPUT: URL requires an authority".into());
    }
    let path_with_query = match url.query() {
        Some(query) => format!("{}?{query}", url.path()),
        None => url.path().to_owned(),
    };

    let request = OutgoingRequest::new(Fields::new());
    request
        .set_method(&Method::Get)
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GET method was rejected".to_string())?;
    request
        .set_path_with_query(Some(&path_with_query))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: path was rejected".to_string())?;
    request
        .set_scheme(Some(&Scheme::Https))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: scheme was rejected".to_string())?;
    request
        .set_authority(Some(&authority))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: authority was rejected".to_string())?;
    let request_body = request
        .body()
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: request body unavailable".to_string())?;
    OutgoingBody::finish(request_body, None).map_err(format_wasi_http_error)?;

    let options = RequestOptions::new();
    let timeout_ns = timeout_ms
        .checked_mul(1_000_000)
        .ok_or("INVALID_INPUT: timeoutMs is too large")?;
    options
        .set_connect_timeout(Some(timeout_ns))
        .map_err(|_| "WASI_HTTP_TIMEOUT_UNSUPPORTED: connect timeout".to_string())?;
    options
        .set_first_byte_timeout(Some(timeout_ns))
        .map_err(|_| "WASI_HTTP_TIMEOUT_UNSUPPORTED: first-byte timeout".to_string())?;
    options
        .set_between_bytes_timeout(Some(timeout_ns))
        .map_err(|_| "WASI_HTTP_TIMEOUT_UNSUPPORTED: between-bytes timeout".to_string())?;

    let pending =
        outgoing_handler::handle(request, Some(options)).map_err(format_wasi_http_error)?;
    let response = loop {
        match pending.get() {
            Some(Ok(Ok(response))) => break response,
            Some(Ok(Err(error))) => return Err(format_wasi_http_error(error)),
            Some(Err(())) => return Err("WASI_HTTP_RESPONSE_ALREADY_CONSUMED".into()),
            None => pending.subscribe().block(),
        }
    };
    let status = response.status();
    let headers = response.headers();
    let location = headers
        .get("location")
        .into_iter()
        .next()
        .and_then(|value| String::from_utf8(value).ok());
    drop(headers);
    let body = response
        .consume()
        .map_err(|_| "WASI_HTTP_RESPONSE_BODY_UNAVAILABLE".to_string())?;
    let stream = body
        .stream()
        .map_err(|_| "WASI_HTTP_RESPONSE_STREAM_UNAVAILABLE".to_string())?;
    let bytes = read_response_body(stream, response_limit_bytes)?;
    drop(body);
    Ok(StandardHttpResponse {
        status,
        body: bytes,
        location,
    })
}

fn read_response_body(
    stream: bindings::wasi::io::streams::InputStream,
    response_limit_bytes: usize,
) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    loop {
        match stream.read(4 * 1024) {
            Ok(chunk) if chunk.is_empty() => stream.subscribe().block(),
            Ok(chunk) => {
                let next_len = bytes
                    .len()
                    .checked_add(chunk.len())
                    .ok_or("HTTP_RESPONSE_TOO_LARGE: response size overflow")?;
                if next_len > response_limit_bytes {
                    return Err(format!(
                        "HTTP_RESPONSE_TOO_LARGE: exceeds {} bytes",
                        response_limit_bytes
                    ));
                }
                bytes.extend_from_slice(&chunk);
            }
            Err(StreamError::Closed) => return Ok(bytes),
            Err(StreamError::LastOperationFailed(error)) => {
                return Err(format!(
                    "WASI_HTTP_RESPONSE_STREAM_FAILED: {}",
                    error.to_debug_string()
                ));
            }
        }
    }
}

fn format_wasi_http_error(error: bindings::wasi::http::types::ErrorCode) -> String {
    format!("WASI_HTTP_ERROR: {error:?}")
}

bindings::export!(CapabilityLab with_types_in bindings);
