#[allow(warnings)]
mod bindings;

use bindings::exports::nextclaw::portable_service::service::{Action, Guest};
use bindings::fermyon::spin::sqlite::{Connection, Error, QueryResult, Value as SqlValue};
use serde_json::{Value, json};

struct SqliteLab;

impl Guest for SqliteLab {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "sqlite_roundtrip".into(),
                title: "写入并查询标准 Spin SQLite".into(),
                description: "通过 fermyon:spin/sqlite 创建表、插入记录并查询结果。".into(),
            },
            Action {
                name: "sqlite_read".into(),
                title: "读取标准 Spin SQLite".into(),
                description: "查询当前 App 实例私有 SQLite 数据库中的指定记录。".into(),
            },
            Action {
                name: "sqlite_permission_denied".into(),
                title: "验证 SQLite 权限拒绝".into(),
                description: "未授予存储时验证标准 Spin SQLite 返回 access-denied。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "sqlite_roundtrip" => sqlite_roundtrip(&input),
            "sqlite_read" => sqlite_read(&input),
            "sqlite_permission_denied" => sqlite_permission_denied(),
            _ => Err(format!("UNKNOWN_ACTION: {action}")),
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

fn sqlite_roundtrip(input: &Value) -> Result<String, String> {
    let key = required_string(input, "key")?;
    let value = required_string(input, "value")?;
    let connection = open_default()?;
    execute(
        &connection,
        "CREATE TABLE IF NOT EXISTS lab_records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
        &[],
    )?;
    execute(
        &connection,
        "INSERT INTO lab_records(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        &[SqlValue::Text(key.clone()), SqlValue::Text(value.clone())],
    )?;
    let result = execute(
        &connection,
        "SELECT key, value FROM lab_records WHERE key = ?",
        &[SqlValue::Text(key.clone())],
    )?;
    let row = result
        .rows
        .first()
        .ok_or("SQLITE_QUERY_FAILED: inserted record was not returned")?;
    let stored_key = text_column(row.values.first())?;
    let stored_value = text_column(row.values.get(1))?;
    Ok(json!({
        "key": stored_key,
        "value": stored_value,
        "rowCount": result.rows.len(),
        "mediatedBy": "fermyon:spin@2.0.0/sqlite",
    })
    .to_string())
}

fn sqlite_read(input: &Value) -> Result<String, String> {
    let key = required_string(input, "key")?;
    let connection = open_default()?;
    execute(
        &connection,
        "CREATE TABLE IF NOT EXISTS lab_records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
        &[],
    )?;
    let result = execute(
        &connection,
        "SELECT key, value FROM lab_records WHERE key = ?",
        &[SqlValue::Text(key.clone())],
    )?;
    let value = result
        .rows
        .first()
        .map(|row| text_column(row.values.get(1)))
        .transpose()?;
    Ok(json!({
        "key": key,
        "value": value,
        "found": value.is_some(),
        "mediatedBy": "fermyon:spin@2.0.0/sqlite",
    })
    .to_string())
}

fn sqlite_permission_denied() -> Result<String, String> {
    match Connection::open("default") {
        Err(Error::AccessDenied) => Ok(json!({
            "denied": true,
            "reason": "access-denied",
            "mediatedBy": "fermyon:spin@2.0.0/sqlite",
        })
        .to_string()),
        Err(error) => Err(format!(
            "SQLITE_PERMISSION_EXPECTED_ACCESS_DENIED: {error:?}"
        )),
        Ok(_) => {
            Err("SQLITE_PERMISSION_UNEXPECTEDLY_ALLOWED: storage permission was not denied".into())
        }
    }
}

fn open_default() -> Result<Connection, String> {
    Connection::open("default").map_err(|error| format!("SPIN_SQLITE_OPEN_FAILED: {error:?}"))
}

fn execute(
    connection: &Connection,
    statement: &str,
    parameters: &[SqlValue],
) -> Result<QueryResult, String> {
    connection
        .execute(statement, parameters)
        .map_err(|error| format!("SPIN_SQLITE_EXECUTE_FAILED: {error:?}"))
}

fn text_column(value: Option<&SqlValue>) -> Result<String, String> {
    match value {
        Some(SqlValue::Text(value)) => Ok(value.clone()),
        value => Err(format!("SQLITE_QUERY_EXPECTED_TEXT: {value:?}")),
    }
}

fn required_string(input: &Value, field: &str) -> Result<String, String> {
    input
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("INVALID_INPUT: {field} is required"))
}

bindings::export!(SqliteLab with_types_in bindings);
