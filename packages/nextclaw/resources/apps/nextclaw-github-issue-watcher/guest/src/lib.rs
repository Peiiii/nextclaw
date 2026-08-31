#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::wasi::{
    clocks::wall_clock,
    config::store as config_store,
    http::{
        outgoing_handler,
        types::{Fields, Method, OutgoingBody, OutgoingRequest, RequestOptions, Scheme},
    },
    io::streams::StreamError,
    keyvalue::store as keyvalue_store,
};
use serde_json::{Value, json};

const STORE_NAME: &str = "default";
const SNAPSHOT_KEY: &str = "github-issues/snapshot";
const GITHUB_TOKEN_SLOT: &str = "github-token";
const MAX_RESPONSE_BYTES: usize = 512 * 1024;
const REQUEST_TIMEOUT_MS: u64 = 10_000;

struct Watcher;

impl Guest for Watcher {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "issues_sync".into(),
                title: "同步 GitHub Issue".into(),
                description: "从 GitHub 同步一个仓库最近的 Issue，并保存在此应用自己的数据中。"
                    .into(),
            },
            Action {
                name: "issues_list".into(),
                title: "查看已同步 Issue".into(),
                description: "读取本应用上次同步的 Issue；可按打开、关闭或全部筛选。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        let input: Value = serde_json::from_str(&input_json)
            .map_err(|_| "INVALID_INPUT: input must be a JSON object".to_string())?;
        match action.as_str() {
            "issues_sync" => sync_issues(&input),
            "issues_list" => list_issues(&input),
            _ => Err(format!("UNKNOWN_ACTION: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> {
        Ok(json!({ "started": true, "mode": "action" }).to_string())
    }

    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("UNSUPPORTED_LIFECYCLE: this app only responds when you request a sync or list".into())
    }

    fn stop(_reason_json: String) -> Result<String, String> {
        Ok(json!({ "stopped": true, "mode": "action" }).to_string())
    }
}

fn sync_issues(input: &Value) -> Result<String, String> {
    let repository = normalized_repository(input.get("repository").and_then(Value::as_str))?;
    let token = optional_github_token()?;
    let response = github_issues_request(&repository, token.as_deref())?;
    if !(200..300).contains(&response.status) {
        return Err(format!(
            "GITHUB_HTTP_{}: GitHub did not accept this repository request",
            response.status
        ));
    }
    let remote_issues: Value = serde_json::from_slice(&response.body).map_err(|_| {
        "GITHUB_RESPONSE_INVALID: GitHub returned an unexpected response".to_string()
    })?;
    let issues = remote_issues
        .as_array()
        .ok_or("GITHUB_RESPONSE_INVALID: GitHub Issue response must be a list")?
        .iter()
        // GitHub returns pull requests from the Issue endpoint too. This app is deliberately
        // an Issue watcher, so do not present PRs as Issues.
        .filter(|issue| issue.get("pull_request").is_none())
        .map(public_issue)
        .collect::<Vec<_>>();
    let now = wall_clock::now();
    let snapshot = json!({
        "repository": repository,
        "issues": issues,
        "syncedAtEpochMs": now.seconds.saturating_mul(1_000).saturating_add(u64::from(now.nanoseconds) / 1_000_000),
        "source": "github-api",
    });
    let bucket = keyvalue_store::open(STORE_NAME).map_err(format_keyvalue_error)?;
    bucket
        .set(SNAPSHOT_KEY, snapshot.to_string().as_bytes())
        .map_err(format_keyvalue_error)?;
    Ok(json!({
        "repository": snapshot["repository"],
        "synced": true,
        "issueCount": snapshot["issues"].as_array().map_or(0, Vec::len),
        "syncedAtEpochMs": snapshot["syncedAtEpochMs"],
        "authenticated": token.is_some(),
        "persistedBy": "wasi:keyvalue/store",
        "requestedVia": "wasi:http/outgoing-handler",
    })
    .to_string())
}

fn list_issues(input: &Value) -> Result<String, String> {
    let state = input.get("state").and_then(Value::as_str).unwrap_or("open");
    if !matches!(state, "open" | "closed" | "all") {
        return Err("INVALID_INPUT: state must be open, closed, or all".into());
    }
    let bucket = keyvalue_store::open(STORE_NAME).map_err(format_keyvalue_error)?;
    let saved = bucket.get(SNAPSHOT_KEY).map_err(format_keyvalue_error)?;
    let Some(saved) = saved else {
        return Ok(json!({
            "repository": null,
            "issues": [],
            "syncedAtEpochMs": null,
            "message": "还没有同步过仓库。先输入 owner/repository 后点击同步。",
            "persistedBy": "wasi:keyvalue/store",
        })
        .to_string());
    };
    let mut snapshot: Value = serde_json::from_slice(&saved)
        .map_err(|_| "STORAGE_CORRUPT: saved Issue data is not valid JSON".to_string())?;
    let filtered = snapshot["issues"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|issue| state == "all" || issue.get("state").and_then(Value::as_str) == Some(state))
        .cloned()
        .collect::<Vec<_>>();
    snapshot["issues"] = Value::Array(filtered);
    snapshot["filter"] = Value::String(state.into());
    snapshot["persistedBy"] = Value::String("wasi:keyvalue/store".into());
    Ok(snapshot.to_string())
}

fn normalized_repository(value: Option<&str>) -> Result<String, String> {
    let repository = value.unwrap_or("").trim();
    let mut segments = repository.split('/');
    let (Some(owner), Some(name), None) = (segments.next(), segments.next(), segments.next())
    else {
        return Err("INVALID_INPUT: repository must be owner/repository".into());
    };
    if owner.is_empty()
        || name.is_empty()
        || owner.len() > 100
        || name.len() > 100
        || !owner.chars().all(is_github_name_character)
        || !name.chars().all(is_github_name_character)
    {
        return Err(
            "INVALID_INPUT: repository must contain only GitHub owner/repository characters".into(),
        );
    }
    Ok(format!("{owner}/{name}"))
}

fn is_github_name_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
}

fn optional_github_token() -> Result<Option<String>, String> {
    let variable = spin_secret_variable_name(GITHUB_TOKEN_SLOT);
    config_store::get(&variable)
        .map_err(|_| "SECRET_UNAVAILABLE: the optional GitHub token could not be read".to_string())
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

struct HttpResponse {
    status: u16,
    body: Vec<u8>,
}

fn github_issues_request(repository: &str, token: Option<&str>) -> Result<HttpResponse, String> {
    let fields = Fields::new();
    fields
        .append("accept", b"application/vnd.github+json")
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub accept header".to_string())?;
    fields
        .append("user-agent", b"NextClaw-GitHub-Issue-Watcher")
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub user-agent header".to_string())?;
    fields
        .append("x-github-api-version", b"2022-11-28")
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub API version header".to_string())?;
    if let Some(token) = token.filter(|token| !token.trim().is_empty()) {
        let authorization = format!("Bearer {token}");
        fields
            .append("authorization", authorization.as_bytes())
            .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub authorization header".to_string())?;
    }
    let request = OutgoingRequest::new(fields);
    request
        .set_method(&Method::Get)
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GET method was rejected".to_string())?;
    request
        .set_scheme(Some(&Scheme::Https))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: HTTPS scheme was rejected".to_string())?;
    request
        .set_authority(Some("api.github.com"))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub authority was rejected".to_string())?;
    request
        .set_path_with_query(Some(&format!(
            "/repos/{repository}/issues?state=all&per_page=20&sort=updated&direction=desc"
        )))
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: GitHub path was rejected".to_string())?;
    let body = request
        .body()
        .map_err(|_| "WASI_HTTP_REQUEST_INVALID: request body unavailable".to_string())?;
    OutgoingBody::finish(body, None).map_err(format_wasi_http_error)?;

    let options = RequestOptions::new();
    let timeout_ns = REQUEST_TIMEOUT_MS * 1_000_000;
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
    let body = response
        .consume()
        .map_err(|_| "WASI_HTTP_RESPONSE_BODY_UNAVAILABLE".to_string())?;
    let stream = body
        .stream()
        .map_err(|_| "WASI_HTTP_RESPONSE_STREAM_UNAVAILABLE".to_string())?;
    Ok(HttpResponse {
        status,
        body: read_response_body(stream)?,
    })
}

fn read_response_body(stream: bindings::wasi::io::streams::InputStream) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    loop {
        match stream.read(8 * 1024) {
            Ok(chunk) if chunk.is_empty() => stream.subscribe().block(),
            Ok(chunk) => {
                let next_length = body
                    .len()
                    .checked_add(chunk.len())
                    .ok_or("GITHUB_RESPONSE_TOO_LARGE: response size overflow")?;
                if next_length > MAX_RESPONSE_BYTES {
                    return Err("GITHUB_RESPONSE_TOO_LARGE: GitHub response exceeds 512 KiB".into());
                }
                body.extend_from_slice(&chunk);
            }
            Err(StreamError::Closed) => return Ok(body),
            Err(StreamError::LastOperationFailed(_)) => {
                return Err("WASI_HTTP_RESPONSE_STREAM_FAILED".into());
            }
        }
    }
}

fn public_issue(issue: &Value) -> Value {
    json!({
        "number": issue.get("number").and_then(Value::as_u64),
        "title": issue.get("title").and_then(Value::as_str).unwrap_or("未命名 Issue"),
        "state": issue.get("state").and_then(Value::as_str).unwrap_or("open"),
        "url": issue.get("html_url").and_then(Value::as_str),
        "updatedAt": issue.get("updated_at").and_then(Value::as_str),
        "author": issue.pointer("/user/login").and_then(Value::as_str),
        "labels": issue.get("labels").and_then(Value::as_array).map(|labels| labels.iter()
            .filter_map(|label| label.get("name").and_then(Value::as_str))
            .collect::<Vec<_>>()).unwrap_or_default(),
    })
}

fn format_wasi_http_error(error: bindings::wasi::http::types::ErrorCode) -> String {
    // WASI HTTP error variants contain transport policy facts, not request
    // headers. Keeping the variant makes a blocked domain/DNS/timeout
    // actionable without ever exposing an optional GitHub token.
    format!("WASI_HTTP_ERROR: {error:?}")
}

fn format_keyvalue_error(_error: keyvalue_store::Error) -> String {
    "WASI_KEYVALUE_ERROR: application storage is unavailable".into()
}

bindings::export!(Watcher with_types_in bindings);
