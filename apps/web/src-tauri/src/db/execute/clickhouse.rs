use crate::db::clickhouse::ClickHouseConnection;
use crate::db::error::DbError;
use crate::db::types::ExecuteResult;

pub async fn execute_clickhouse(
    conn: &ClickHouseConnection,
    sql: &str,
    max_rows: usize,
    schema: Option<&str>,
) -> Result<ExecuteResult, DbError> {
    let (columns, rows, row_count, is_truncated) = conn.query(sql, schema, Some(max_rows)).await?;

    Ok(ExecuteResult::Tabular {
        columns,
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated,
    })
}
