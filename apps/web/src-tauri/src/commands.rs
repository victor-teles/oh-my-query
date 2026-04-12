use std::time::Instant;

use tauri::State;

use crate::cancellation::CancellationRegistry;
use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::execute::execute_for_pool;
use crate::db::pool::ConnectionPoolManager;
use crate::db::schema::{fetch_schema, list_databases};
use crate::db::transpile::{format_sql as do_format_sql, pool_dialect, transpile_sql};
use crate::db::types::{
    ConnectionParams, ExecuteResult, QueryParams, SchemaInfo, TestConnectionResult,
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
            let target = pool_dialect(&pool);
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
