mod mongodb;
mod redis;
mod sql;

use crate::db::error::DbError;
use crate::db::pool::DatabasePool;
use crate::db::types::ExecuteResult;

pub async fn execute_for_pool(
    pool: &DatabasePool,
    command: &str,
    max_rows: usize,
    schema: Option<&str>,
) -> Result<ExecuteResult, DbError> {
    match pool {
        DatabasePool::Postgres(_) | DatabasePool::MySql(_) | DatabasePool::Sqlite(_) => {
            let (columns, rows, is_truncated) =
                sql::fetch_sql_rows(pool, command, max_rows, schema).await?;
            Ok(ExecuteResult::Tabular {
                row_count: rows.len() as u64,
                columns,
                rows,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        DatabasePool::MongoDB(client) => {
            mongodb::execute_mongodb(client, command, max_rows).await
        }
        DatabasePool::Redis(conn) => redis::execute_redis(&mut conn.clone(), command).await,
    }
}
