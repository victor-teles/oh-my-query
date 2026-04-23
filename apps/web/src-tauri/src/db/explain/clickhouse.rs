use std::time::Instant;

use crate::db::clickhouse::ClickHouseConnection;
use crate::db::error::DbError;

use super::parser::parse_clickhouse;
use super::ExplainResult;

pub async fn explain_clickhouse(
    conn: &ClickHouseConnection,
    sql: &str,
    schema: Option<&str>,
) -> Result<ExplainResult, DbError> {
    let trimmed = sql.trim().trim_end_matches(';').trim();
    if trimmed.is_empty() {
        return Err(DbError {
            code: "EXPLAIN_EMPTY".to_string(),
            message: "Cannot EXPLAIN empty SQL".to_string(),
        });
    }

    let wrapped = format!("EXPLAIN json = 1, actions = 0, indexes = 0 {trimmed}");
    let start = Instant::now();
    let (_columns, rows, _count, _trunc) = conn.query(&wrapped, schema, Some(1)).await?;

    let first_cell = rows
        .into_iter()
        .next()
        .and_then(|r| r.into_iter().next())
        .ok_or_else(|| DbError {
            code: "EXPLAIN_PARSE_ERROR".to_string(),
            message: "ClickHouse EXPLAIN returned no rows".to_string(),
        })?;

    let json_text = match first_cell {
        serde_json::Value::String(s) => s,
        other => other.to_string(),
    };

    let parsed: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: format!("Failed to parse ClickHouse EXPLAIN JSON: {e}"),
    })?;

    let raw = serde_json::to_string_pretty(&parsed).unwrap_or(json_text);
    let root = parse_clickhouse(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "clickhouse",
        root,
        raw,
        analyze_ran: false,
        supports_analyze: false,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}
