use std::time::Instant;

use tauri::State;

use crate::cancellation::CancellationRegistry;
use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::execute::execute_for_pool;
use crate::db::explain::{explain_for_pool, ExplainParams, ExplainResult};
use crate::db::pool::{ConnectionPoolManager, DatabasePool};
use crate::db::redis_keys::{
    delete_redis_key as do_delete_redis_key, redis_db_info as do_redis_db_info,
    scan_redis_keys as do_scan_redis_keys,
};
use crate::db::schema::{fetch_schema, list_databases};
use crate::db::transpile::{format_sql as do_format_sql, pool_dialect, transpile_sql};
use crate::db::types::{
    ConnectionParams, ExecuteResult, QueryParams, RedisDbInfo, RedisScanPage, SchemaInfo,
    TestConnectionResult,
};
use crate::db::version::fetch_version;

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
    cancellation: State<'_, CancellationRegistry>,
) -> Result<ExecuteResult, DbError> {
    let pool = state.get_pool(&params.connection_id).await?;
    let max_rows = params.max_rows.unwrap_or(DEFAULT_MAX_ROWS) as usize;
    let timeout_secs = params.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

    let sql = match params.source_dialect.as_deref() {
        Some(source) => {
            let target = pool_dialect(&pool)?;
            transpile_sql(&params.sql, source, target)?
        }
        None => params.sql.clone(),
    };

    let cancel_rx = params
        .query_id
        .as_ref()
        .map(|id| cancellation.register(id.clone()));

    let start = Instant::now();

    let query_future = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        execute_for_pool(&pool, &sql, max_rows, params.schema.as_deref()),
    );

    let result = match cancel_rx {
        Some(rx) => tokio::select! {
            biased;
            _ = rx => {
                if let Some(query_id) = params.query_id.as_deref() {
                    cancellation.remove(query_id);
                }
                return Err(DbError::cancelled());
            }
            res = query_future => res,
        },
        None => query_future.await,
    };

    if let Some(query_id) = params.query_id.as_deref() {
        cancellation.remove(query_id);
    }

    let mut execute_result = result.map_err(DbError::from)??;
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

#[tauri::command]
pub async fn explain_query(
    params: ExplainParams,
    state: State<'_, ConnectionPoolManager>,
    cancellation: State<'_, CancellationRegistry>,
) -> Result<ExplainResult, DbError> {
    let pool = state.get_pool(&params.connection_id).await?;
    let timeout_secs = params.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

    let sql = match params.source_dialect.as_deref() {
        Some(source) => {
            let target = pool_dialect(&pool)?;
            transpile_sql(&params.sql, source, target)?
        }
        None => params.sql.clone(),
    };

    let cancel_rx = params
        .query_id
        .as_ref()
        .map(|id| cancellation.register(id.clone()));

    let query_future = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        explain_for_pool(&pool, &sql, params.analyze, params.schema.as_deref()),
    );

    let result = match cancel_rx {
        Some(rx) => tokio::select! {
            biased;
            _ = rx => {
                if let Some(query_id) = params.query_id.as_deref() {
                    cancellation.remove(query_id);
                }
                return Err(DbError::cancelled());
            }
            res = query_future => res,
        },
        None => query_future.await,
    };

    if let Some(query_id) = params.query_id.as_deref() {
        cancellation.remove(query_id);
    }

    result.map_err(DbError::from)?
}

#[tauri::command]
pub async fn cancel_query(
    query_id: String,
    cancellation: State<'_, CancellationRegistry>,
) -> Result<bool, DbError> {
    Ok(cancellation.cancel(&query_id))
}

#[tauri::command]
pub async fn format_sql(sql: String, dialect: String) -> Result<String, DbError> {
    do_format_sql(&sql, &dialect)
}

fn require_redis(pool: &DatabasePool) -> Result<&redis::aio::MultiplexedConnection, DbError> {
    match pool {
        DatabasePool::Redis(conn) => Ok(conn),
        _ => Err(DbError {
            code: "WRONG_DRIVER".to_string(),
            message: "This command is only available for Redis connections".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn redis_db_info(
    connection_id: String,
    db_index: u8,
    state: State<'_, ConnectionPoolManager>,
) -> Result<RedisDbInfo, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    let conn = require_redis(&pool)?;
    do_redis_db_info(conn, db_index).await
}

#[tauri::command]
pub async fn scan_redis_keys(
    connection_id: String,
    db_index: u8,
    pattern: Option<String>,
    cursor: Option<String>,
    count: Option<u32>,
    state: State<'_, ConnectionPoolManager>,
) -> Result<RedisScanPage, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    let conn = require_redis(&pool)?;
    let cursor_ref = cursor.as_deref().unwrap_or("0");
    do_scan_redis_keys(conn, db_index, pattern.as_deref(), cursor_ref, count).await
}

#[tauri::command]
pub async fn delete_redis_key(
    connection_id: String,
    db_index: u8,
    name: String,
    state: State<'_, ConnectionPoolManager>,
) -> Result<u64, DbError> {
    let pool = state.get_pool(&connection_id).await?;
    let conn = require_redis(&pool)?;
    do_delete_redis_key(conn, db_index, &name).await
}
