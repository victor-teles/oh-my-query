use std::time::Instant;

use futures::TryStreamExt;
use tauri::State;

use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::pool::{ConnectionPoolManager, DatabasePool};
use crate::db::schema::{fetch_schema, list_databases};
use crate::db::types::{
    ColumnInfo, ConnectionParams, ExecuteResult, QueryParams, SchemaInfo, TestConnectionResult,
};

const DEFAULT_MAX_ROWS: u64 = 10_000;
const DEFAULT_TIMEOUT_SECS: u64 = 30;

#[tauri::command]
pub async fn test_connection(params: ConnectionParams) -> Result<TestConnectionResult, DbError> {
    let driver = get_driver(&params.db_type)?;
    driver.test_connection(&params).await
}

#[tauri::command]
pub async fn connect_to_database(
    connection_id: String,
    params: ConnectionParams,
    state: State<'_, ConnectionPoolManager>,
) -> Result<(), DbError> {
    state.connect(&connection_id, &params).await
}

#[tauri::command]
pub async fn disconnect_from_database(
    connection_id: String,
    state: State<'_, ConnectionPoolManager>,
) -> Result<(), DbError> {
    state.disconnect(&connection_id).await
}

#[tauri::command]
pub async fn get_server_version(
    connection_id: String,
    state: State<'_, ConnectionPoolManager>,
) -> Result<String, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    fetch_version(&pool).await
}

#[tauri::command]
pub async fn list_connection_databases(
    connection_id: String,
    state: State<'_, ConnectionPoolManager>,
) -> Result<Vec<String>, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    list_databases(&pool).await
}

#[tauri::command]
pub async fn get_schema(
    connection_id: String,
    database_name: String,
    state: State<'_, ConnectionPoolManager>,
) -> Result<SchemaInfo, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    fetch_schema(&pool, &database_name).await
}

#[tauri::command]
pub async fn execute_query(
    params: QueryParams,
    state: State<'_, ConnectionPoolManager>,
) -> Result<ExecuteResult, DbError> {
    let pool = state.get_pool(&params.connection_id).await?;
    let max_rows = params.max_rows.unwrap_or(DEFAULT_MAX_ROWS) as usize;
    let timeout_secs = params.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

    let start = Instant::now();

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        execute_for_pool(&pool, &params.sql, max_rows),
    )
    .await
    .map_err(DbError::from)?;

    let mut execute_result = result?;
    let execution_time_ms = start.elapsed().as_millis() as u64;

    match &mut execute_result {
        ExecuteResult::Tabular {
            execution_time_ms: t,
            ..
        } => *t = execution_time_ms,
        ExecuteResult::Documents {
            execution_time_ms: t,
            ..
        } => *t = execution_time_ms,
    }

    Ok(execute_result)
}

async fn execute_for_pool(
    pool: &DatabasePool,
    command: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    match pool {
        DatabasePool::Postgres(_) | DatabasePool::MySql(_) | DatabasePool::Sqlite(_) => {
            let (columns, rows, is_truncated) = fetch_sql_rows(pool, command, max_rows).await?;
            Ok(ExecuteResult::Tabular {
                row_count: rows.len() as u64,
                columns,
                rows,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        DatabasePool::MongoDB(client) => execute_mongodb(client, command, max_rows).await,
        DatabasePool::Redis(conn) => execute_redis(&mut conn.clone(), command).await,
    }
}

// ---------------------------------------------------------------------------
// SQL execution
// ---------------------------------------------------------------------------

macro_rules! fetch_rows_native {
    ($pool:expr, $sql:expr, $max_rows:expr) => {{
        use sqlx::{Column, Row, TypeInfo, ValueRef};

        let mut stream = sqlx::query($sql).fetch($pool);
        let mut columns: Option<Vec<ColumnInfo>> = None;
        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut is_truncated = false;

        while let Some(row) = stream.try_next().await.map_err(DbError::from)? {
            if columns.is_none() {
                let cols = row.columns();
                let mut col_info = Vec::with_capacity(cols.len());
                for col in cols {
                    col_info.push(ColumnInfo {
                        name: col.name().to_string(),
                        type_name: col.type_info().name().to_string(),
                    });
                }
                columns = Some(col_info);
            }

            if rows.len() >= $max_rows {
                is_truncated = true;
                break;
            }

            let num_cols = row.columns().len();
            let mut vals = Vec::with_capacity(num_cols);
            for idx in 0..num_cols {
                let type_name = row.column(idx).type_info().name().to_uppercase();

                if row.try_get_raw(idx).is_ok_and(|v| v.is_null()) {
                    vals.push(serde_json::Value::Null);
                    continue;
                }

                let val = match type_name.as_str() {
                    "BOOL" | "BOOLEAN" => row
                        .try_get::<bool, _>(idx)
                        .map(serde_json::Value::Bool)
                        .unwrap_or(serde_json::Value::Null),

                    "INT2" | "SMALLINT" | "INT4" | "INT" | "INTEGER" | "INT8" | "BIGINT"
                    | "TINYINT" | "MEDIUMINT" => row
                        .try_get::<i64, _>(idx)
                        .map(|v: i64| serde_json::Value::Number(v.into()))
                        .unwrap_or(serde_json::Value::Null),

                    "FLOAT4" | "FLOAT8" | "REAL" | "DOUBLE" | "DOUBLE PRECISION" | "NUMERIC"
                    | "DECIMAL" | "FLOAT" => row
                        .try_get::<f64, _>(idx)
                        .ok()
                        .and_then(|v| {
                            serde_json::Number::from_f64(v).map(serde_json::Value::Number)
                        })
                        .unwrap_or(serde_json::Value::Null),

                    _ => row
                        .try_get::<String, _>(idx)
                        .map(serde_json::Value::String)
                        .unwrap_or(serde_json::Value::Null),
                };
                vals.push(val);
            }
            rows.push(vals);
        }

        Ok::<_, DbError>((columns.unwrap_or_default(), rows, is_truncated))
    }};
}

async fn fetch_sql_rows(
    pool: &DatabasePool,
    sql: &str,
    max_rows: usize,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    match pool {
        DatabasePool::Postgres(pool) => fetch_rows_native!(pool, sql, max_rows),
        DatabasePool::MySql(pool) => fetch_rows_native!(pool, sql, max_rows),
        DatabasePool::Sqlite(pool) => fetch_rows_native!(pool, sql, max_rows),
        _ => unreachable!(),
    }
}

// ---------------------------------------------------------------------------
// MongoDB execution
// ---------------------------------------------------------------------------

struct MongoCommand {
    collection: String,
    operation: String,
    args: Vec<String>,
}

fn parse_mongo_command(input: &str) -> Result<MongoCommand, DbError> {
    let input = input.trim();
    let input = input.strip_prefix("db.").ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "MongoDB command must start with 'db.'".to_string(),
    })?;

    let dot_pos = input.find('.').ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "Expected format: db.collection.operation(...)".to_string(),
    })?;

    let collection = input[..dot_pos].to_string();
    let rest = &input[dot_pos + 1..];

    let paren_pos = rest.find('(').ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "Expected format: db.collection.operation(...)".to_string(),
    })?;

    let operation = rest[..paren_pos].to_string();

    let args_str = rest[paren_pos + 1..]
        .strip_suffix(')')
        .ok_or_else(|| DbError {
            code: "PARSE_ERROR".to_string(),
            message: "Missing closing parenthesis".to_string(),
        })?
        .trim();

    let args = if args_str.is_empty() {
        vec![]
    } else {
        split_json_args(args_str)
    };

    Ok(MongoCommand {
        collection,
        operation,
        args,
    })
}

fn split_json_args(input: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut depth = 0;
    let mut start = 0;

    for (i, ch) in input.char_indices() {
        match ch {
            '{' | '[' => depth += 1,
            '}' | ']' => depth -= 1,
            ',' if depth == 0 => {
                let arg = input[start..i].trim().to_string();
                if !arg.is_empty() {
                    args.push(arg);
                }
                start = i + 1;
            }
            _ => {}
        }
    }

    let last = input[start..].trim().to_string();
    if !last.is_empty() {
        args.push(last);
    }

    args
}

fn parse_bson_doc(json_str: &str) -> Result<mongodb::bson::Document, DbError> {
    let value: serde_json::Value = serde_json::from_str(json_str).map_err(|e| DbError {
        code: "PARSE_ERROR".to_string(),
        message: format!("Invalid JSON: {e}"),
    })?;
    let bson = mongodb::bson::to_bson(&value).map_err(|e| DbError {
        code: "PARSE_ERROR".to_string(),
        message: format!("Cannot convert to BSON: {e}"),
    })?;
    match bson {
        mongodb::bson::Bson::Document(doc) => Ok(doc),
        _ => Err(DbError {
            code: "PARSE_ERROR".to_string(),
            message: "Expected a JSON object".to_string(),
        }),
    }
}

fn bson_doc_to_json(doc: &mongodb::bson::Document) -> serde_json::Value {
    let bson = mongodb::bson::Bson::Document(doc.clone());
    bson.clone().into_relaxed_extjson()
}

async fn execute_mongodb(
    client: &mongodb::Client,
    command: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    let cmd = parse_mongo_command(command)?;
    let db = client.default_database().ok_or_else(|| DbError {
        code: "NO_DATABASE".to_string(),
        message: "No default database selected. Specify a database in the connection.".to_string(),
    })?;
    let coll = db.collection::<mongodb::bson::Document>(&cmd.collection);

    match cmd.operation.as_str() {
        "find" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let mut cursor = coll
                .find(filter)
                .limit(max_rows as i64)
                .await
                .map_err(DbError::from)?;

            let mut documents = Vec::new();
            let mut is_truncated = false;

            while cursor.advance().await.map_err(DbError::from)? {
                if documents.len() >= max_rows {
                    is_truncated = true;
                    break;
                }
                let doc = cursor.deserialize_current().map_err(DbError::from)?;
                documents.push(bson_doc_to_json(&doc));
            }

            let count = documents.len() as u64;
            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        "findOne" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let doc = coll.find_one(filter).await.map_err(DbError::from)?;
            let documents = match doc {
                Some(d) => vec![bson_doc_to_json(&d)],
                None => vec![],
            };
            let count = documents.len() as u64;

            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "insertOne" => {
            let doc = parse_bson_doc(cmd.args.first().ok_or_else(|| DbError {
                code: "PARSE_ERROR".to_string(),
                message: "insertOne requires a document argument".to_string(),
            })?)?;

            let result = coll.insert_one(doc).await.map_err(DbError::from)?;
            let id_str = format!("{}", result.inserted_id);

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "insertedId".to_string(),
                    type_name: "ObjectId".to_string(),
                }],
                rows: vec![vec![serde_json::Value::String(id_str)]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "updateOne" => {
            if cmd.args.len() < 2 {
                return Err(DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: "updateOne requires filter and update arguments".to_string(),
                });
            }
            let filter = parse_bson_doc(&cmd.args[0])?;
            let update = parse_bson_doc(&cmd.args[1])?;

            let result = coll
                .update_one(filter, update)
                .await
                .map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![
                    ColumnInfo {
                        name: "matchedCount".to_string(),
                        type_name: "INT".to_string(),
                    },
                    ColumnInfo {
                        name: "modifiedCount".to_string(),
                        type_name: "INT".to_string(),
                    },
                ],
                rows: vec![vec![
                    serde_json::Value::Number(result.matched_count.into()),
                    serde_json::Value::Number(result.modified_count.into()),
                ]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "deleteOne" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let result = coll.delete_one(filter).await.map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "deletedCount".to_string(),
                    type_name: "INT".to_string(),
                }],
                rows: vec![vec![serde_json::Value::Number(
                    result.deleted_count.into(),
                )]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "countDocuments" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let count = coll
                .count_documents(filter)
                .await
                .map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "count".to_string(),
                    type_name: "INT".to_string(),
                }],
                rows: vec![vec![serde_json::Value::Number(count.into())]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "aggregate" => {
            let pipeline_str = cmd.args.first().ok_or_else(|| DbError {
                code: "PARSE_ERROR".to_string(),
                message: "aggregate requires a pipeline argument".to_string(),
            })?;

            let pipeline_value: serde_json::Value =
                serde_json::from_str(pipeline_str).map_err(|e| DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Invalid JSON pipeline: {e}"),
                })?;

            let pipeline_bson =
                mongodb::bson::to_bson(&pipeline_value).map_err(|e| DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Cannot convert pipeline to BSON: {e}"),
                })?;

            let pipeline = match pipeline_bson {
                mongodb::bson::Bson::Array(arr) => {
                    let mut docs = Vec::new();
                    for item in arr {
                        match item {
                            mongodb::bson::Bson::Document(doc) => docs.push(doc),
                            _ => {
                                return Err(DbError {
                                    code: "PARSE_ERROR".to_string(),
                                    message: "Pipeline stages must be objects".to_string(),
                                })
                            }
                        }
                    }
                    docs
                }
                _ => {
                    return Err(DbError {
                        code: "PARSE_ERROR".to_string(),
                        message: "Pipeline must be an array".to_string(),
                    })
                }
            };

            let mut cursor = coll.aggregate(pipeline).await.map_err(DbError::from)?;
            let mut documents = Vec::new();
            let mut is_truncated = false;

            while cursor.advance().await.map_err(DbError::from)? {
                if documents.len() >= max_rows {
                    is_truncated = true;
                    break;
                }
                let doc = cursor.deserialize_current().map_err(DbError::from)?;
                documents.push(bson_doc_to_json(&doc));
            }

            let count = documents.len() as u64;
            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        other => Err(DbError {
            code: "UNSUPPORTED_OPERATION".to_string(),
            message: format!(
                "Unsupported MongoDB operation: {other}. Supported: find, findOne, insertOne, updateOne, deleteOne, countDocuments, aggregate"
            ),
        }),
    }
}

// ---------------------------------------------------------------------------
// Redis execution
// ---------------------------------------------------------------------------

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

async fn execute_redis(
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

// ---------------------------------------------------------------------------
// Version fetching
// ---------------------------------------------------------------------------

async fn fetch_version(pool: &DatabasePool) -> Result<String, DbError> {
    use sqlx::Row;

    match pool {
        DatabasePool::Postgres(pool) => {
            let row = sqlx::query("SELECT version()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let full: String = row.try_get(0).unwrap_or_default();
            Ok(full
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" "))
        }
        DatabasePool::MySql(pool) => {
            let row = sqlx::query("SELECT VERSION()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let ver: String = row.try_get(0).unwrap_or_default();
            Ok(format!("MySQL {ver}"))
        }
        DatabasePool::Sqlite(pool) => {
            let row = sqlx::query("SELECT sqlite_version()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let ver: String = row.try_get(0).unwrap_or_default();
            Ok(format!("SQLite {ver}"))
        }
        DatabasePool::MongoDB(client) => {
            let result = client
                .database("admin")
                .run_command(mongodb::bson::doc! { "buildInfo": 1 })
                .await
                .map_err(DbError::from)?;
            let version = result.get_str("version").unwrap_or("unknown");
            Ok(format!("MongoDB {version}"))
        }
        DatabasePool::Redis(conn) => {
            let info: String = redis::cmd("INFO")
                .arg("server")
                .query_async(&mut conn.clone())
                .await
                .map_err(DbError::from)?;
            let version = info
                .lines()
                .find(|l| l.starts_with("redis_version:"))
                .and_then(|l| l.strip_prefix("redis_version:"))
                .unwrap_or("unknown")
                .trim();
            Ok(format!("Redis {version}"))
        }
    }
}
