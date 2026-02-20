use crate::db::error::DbError;
use crate::db::types::{ColumnInfo, ExecuteResult};

fn parse_redis_args(input: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';

    for ch in input.chars() {
        if in_quotes {
            if ch == quote_char {
                in_quotes = false;
            } else {
                current.push(ch);
            }
        } else if ch == '"' || ch == '\'' {
            in_quotes = true;
            quote_char = ch;
        } else if ch.is_whitespace() {
            if !current.is_empty() {
                args.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }

    if !current.is_empty() {
        args.push(current);
    }

    args
}

pub async fn execute_redis(
    conn: &mut redis::aio::MultiplexedConnection,
    command: &str,
) -> Result<ExecuteResult, DbError> {
    let parts = parse_redis_args(command.trim());
    if parts.is_empty() {
        return Err(DbError {
            code: "PARSE_ERROR".to_string(),
            message: "Empty Redis command".to_string(),
        });
    }

    let cmd_name = parts[0].to_uppercase();
    let mut cmd = redis::cmd(&cmd_name);
    for arg in &parts[1..] {
        cmd.arg(arg.as_str());
    }

    let value: redis::Value = cmd.query_async(conn).await.map_err(DbError::from)?;

    let is_hash_command = matches!(
        cmd_name.as_str(),
        "HGETALL" | "HSCAN" | "HKEYS" | "HVALS" | "HMGET"
    );

    Ok(redis_value_to_result(&value, &cmd_name, is_hash_command))
}

fn redis_value_to_result(value: &redis::Value, cmd_name: &str, is_hash: bool) -> ExecuteResult {
    match value {
        redis::Value::Nil => ExecuteResult::Tabular {
            columns: vec![ColumnInfo {
                name: "value".to_string(),
                type_name: "TEXT".to_string(),
            }],
            rows: vec![vec![serde_json::Value::Null]],
            row_count: 1,
            execution_time_ms: 0,
            is_truncated: false,
        },
        redis::Value::Int(n) => ExecuteResult::Tabular {
            columns: vec![ColumnInfo {
                name: "value".to_string(),
                type_name: "INT".to_string(),
            }],
            rows: vec![vec![serde_json::Value::Number((*n).into())]],
            row_count: 1,
            execution_time_ms: 0,
            is_truncated: false,
        },
        redis::Value::BulkString(bytes) => {
            let s = String::from_utf8_lossy(bytes).to_string();
            ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "value".to_string(),
                    type_name: "TEXT".to_string(),
                }],
                rows: vec![vec![serde_json::Value::String(s)]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            }
        }
        redis::Value::SimpleString(s) => ExecuteResult::Tabular {
            columns: vec![ColumnInfo {
                name: "value".to_string(),
                type_name: "TEXT".to_string(),
            }],
            rows: vec![vec![serde_json::Value::String(s.clone())]],
            row_count: 1,
            execution_time_ms: 0,
            is_truncated: false,
        },
        redis::Value::Okay => ExecuteResult::Tabular {
            columns: vec![ColumnInfo {
                name: "result".to_string(),
                type_name: "TEXT".to_string(),
            }],
            rows: vec![vec![serde_json::Value::String("OK".to_string())]],
            row_count: 1,
            execution_time_ms: 0,
            is_truncated: false,
        },
        redis::Value::Array(items) => {
            if is_hash && cmd_name == "HGETALL" && items.len() >= 2 {
                let mut rows = Vec::new();
                for pair in items.chunks(2) {
                    let field = redis_value_to_string(&pair[0]);
                    let val = if pair.len() > 1 {
                        redis_value_to_string(&pair[1])
                    } else {
                        serde_json::Value::Null
                    };
                    rows.push(vec![field, val]);
                }
                let row_count = rows.len() as u64;
                ExecuteResult::Tabular {
                    columns: vec![
                        ColumnInfo {
                            name: "field".to_string(),
                            type_name: "TEXT".to_string(),
                        },
                        ColumnInfo {
                            name: "value".to_string(),
                            type_name: "TEXT".to_string(),
                        },
                    ],
                    rows,
                    row_count,
                    execution_time_ms: 0,
                    is_truncated: false,
                }
            } else {
                let rows: Vec<Vec<serde_json::Value>> = items
                    .iter()
                    .map(|item| vec![redis_value_to_string(item)])
                    .collect();
                let row_count = rows.len() as u64;
                ExecuteResult::Tabular {
                    columns: vec![ColumnInfo {
                        name: "value".to_string(),
                        type_name: "TEXT".to_string(),
                    }],
                    rows,
                    row_count,
                    execution_time_ms: 0,
                    is_truncated: false,
                }
            }
        }
        _ => ExecuteResult::Tabular {
            columns: vec![ColumnInfo {
                name: "value".to_string(),
                type_name: "TEXT".to_string(),
            }],
            rows: vec![vec![serde_json::Value::String(format!("{value:?}"))]],
            row_count: 1,
            execution_time_ms: 0,
            is_truncated: false,
        },
    }
}

fn redis_value_to_string(value: &redis::Value) -> serde_json::Value {
    match value {
        redis::Value::Nil => serde_json::Value::Null,
        redis::Value::Int(n) => serde_json::Value::Number((*n).into()),
        redis::Value::BulkString(bytes) => {
            serde_json::Value::String(String::from_utf8_lossy(bytes).to_string())
        }
        redis::Value::SimpleString(s) => serde_json::Value::String(s.clone()),
        redis::Value::Okay => serde_json::Value::String("OK".to_string()),
        _ => serde_json::Value::String(format!("{value:?}")),
    }
}
