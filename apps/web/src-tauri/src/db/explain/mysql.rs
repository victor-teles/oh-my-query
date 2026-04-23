use std::time::Instant;

use futures::TryStreamExt;
use sqlx::Row;

use crate::db::error::DbError;
use crate::db::execute::validate_schema_name;

use super::parser::parse_mysql;
use super::ExplainResult;

pub async fn explain_mysql(
    pool: &sqlx::MySqlPool,
    sql: &str,
    analyze: bool,
    schema: Option<&str>,
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

    let wrapped = format!("EXPLAIN FORMAT=JSON {trimmed}");
    let analyze_ran = false;

    let mut conn = pool.acquire().await.map_err(DbError::from)?;
    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("USE `{schema_name}`"))
            .execute(&mut *conn)
            .await
            .map_err(DbError::from)?;
    }

    let start = Instant::now();
    let mut stream = sqlx::raw_sql(&wrapped).fetch(&mut *conn);
    let row = stream
        .try_next()
        .await
        .map_err(DbError::from)?
        .ok_or_else(|| DbError {
            code: "EXPLAIN_PARSE_ERROR".to_string(),
            message: "MySQL EXPLAIN returned no rows".to_string(),
        })?;

    let json_text: String = row.try_get(0).map_err(DbError::from)?;
    drop(stream);
    let parsed: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: format!("Failed to parse MySQL EXPLAIN JSON: {e}"),
    })?;

    let raw = serde_json::to_string_pretty(&parsed).unwrap_or(json_text);
    let root = parse_mysql(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "mysql",
        root,
        raw,
        analyze_ran,
        supports_analyze: false,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}

fn guard_destructive(sql: &str) -> Result<(), DbError> {
    let head = sql
        .split_ascii_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    match head.as_str() {
        "SELECT" | "WITH" | "VALUES" | "TABLE" => Ok(()),
        _ => Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: format!(
                "Refusing to EXPLAIN ANALYZE on a {head} statement — it would execute."
            ),
        }),
    }
}
