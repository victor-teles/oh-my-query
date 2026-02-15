use std::time::Instant;

use tauri::State;

use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::pool::{ConnectionPoolManager, DatabasePool};
use crate::db::types::{
    ColumnInfo, ConnectionParams, QueryParams, QueryResult, TestConnectionResult,
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
pub async fn execute_query(
    params: QueryParams,
    state: State<'_, ConnectionPoolManager>,
) -> Result<QueryResult, DbError> {
    let pool = state.get_pool(&params.connection_id).await?;
    let max_rows = params.max_rows.unwrap_or(DEFAULT_MAX_ROWS) as usize;
    let timeout_secs = params.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

    let start = Instant::now();

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        fetch_rows(&pool, &params.sql, max_rows),
    )
    .await
    .map_err(DbError::from)?;

    let (columns, rows, is_truncated) = result?;
    let execution_time_ms = start.elapsed().as_millis() as u64;

    Ok(QueryResult {
        row_count: rows.len() as u64,
        columns,
        rows,
        execution_time_ms,
        is_truncated,
    })
}

macro_rules! fetch_rows_native {
    ($pool:expr, $sql:expr, $max_rows:expr) => {{
        use futures::TryStreamExt;
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

async fn fetch_rows(
    pool: &DatabasePool,
    sql: &str,
    max_rows: usize,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    match pool {
        DatabasePool::Postgres(pool) => fetch_rows_native!(pool, sql, max_rows),
        DatabasePool::MySql(pool) => fetch_rows_native!(pool, sql, max_rows),
        DatabasePool::Sqlite(pool) => fetch_rows_native!(pool, sql, max_rows),
    }
}

async fn fetch_version(pool: &DatabasePool) -> Result<String, DbError> {
    use sqlx::Row;

    match pool {
        DatabasePool::Postgres(pool) => {
            let row = sqlx::query("SELECT version()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let full: String = row.try_get(0).unwrap_or_default();
            Ok(full.split_whitespace().take(2).collect::<Vec<_>>().join(" "))
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
    }
}
