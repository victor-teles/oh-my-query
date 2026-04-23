use std::time::Instant;

use crate::db::duckdb::DuckDbHandle;
use crate::db::error::DbError;

use super::parser::parse_duckdb;
use super::ExplainResult;

pub async fn explain_duckdb(
    handle: &DuckDbHandle,
    sql: &str,
    analyze: bool,
) -> Result<ExplainResult, DbError> {
    let trimmed = sql.trim().trim_end_matches(';').trim();
    if trimmed.is_empty() {
        return Err(DbError {
            code: "EXPLAIN_EMPTY".to_string(),
            message: "Cannot EXPLAIN empty SQL".to_string(),
        });
    }

    if analyze {
        guard_destructive(trimmed)?;
    }

    let format_opt = if analyze {
        "ANALYZE, FORMAT JSON"
    } else {
        "FORMAT JSON"
    };
    let wrapped = format!("EXPLAIN ({format_opt}) {trimmed}");

    let handle = handle.clone();
    let start = Instant::now();
    let json_text = tokio::task::spawn_blocking(move || fetch_duckdb_json(&handle, &wrapped))
        .await
        .map_err(|e| DbError {
            code: "DUCKDB_JOIN_ERROR".to_string(),
            message: e.to_string(),
        })??;

    let parsed: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: format!("Failed to parse DuckDB EXPLAIN JSON: {e}"),
    })?;

    let raw = serde_json::to_string_pretty(&parsed).unwrap_or(json_text);
    let root = parse_duckdb(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "duckdb",
        root,
        raw,
        analyze_ran: analyze,
        supports_analyze: true,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}

fn fetch_duckdb_json(handle: &DuckDbHandle, sql: &str) -> Result<String, DbError> {
    let conn = handle.blocking_lock();
    let mut stmt = conn.prepare(sql).map_err(DbError::from)?;
    let mut rows = stmt.query([]).map_err(DbError::from)?;

    let mut plan_value: Option<String> = None;
    while let Some(row) = rows.next().map_err(DbError::from)? {
        let key: String = row.get(0).unwrap_or_default();
        let value: String = row.get(1).unwrap_or_default();
        if key == "physical_plan" || key == "logical_plan" || key == "analyzed_plan" {
            plan_value = Some(value);
            if key == "physical_plan" {
                break;
            }
        } else if plan_value.is_none() {
            plan_value = Some(value);
        }
    }

    plan_value.ok_or_else(|| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: "DuckDB EXPLAIN returned no plan".to_string(),
    })
}

fn guard_destructive(sql: &str) -> Result<(), DbError> {
    let head = sql
        .split_ascii_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    match head.as_str() {
        "SELECT" | "WITH" | "VALUES" | "TABLE" | "SHOW" | "DESCRIBE" | "PRAGMA" => Ok(()),
        _ => Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: format!(
                "Refusing to EXPLAIN ANALYZE on a {head} statement — it would execute."
            ),
        }),
    }
}
