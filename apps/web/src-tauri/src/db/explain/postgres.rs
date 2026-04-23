use std::time::Instant;

use futures::TryStreamExt;
use sqlx::Row;

use crate::db::error::DbError;
use crate::db::execute::validate_schema_name;

use super::parser::parse_postgres;
use super::ExplainResult;

pub async fn explain_postgres(
    pool: &sqlx::PgPool,
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

    let options = if analyze {
        "ANALYZE, BUFFERS, VERBOSE, FORMAT JSON"
    } else {
        "VERBOSE, FORMAT JSON"
    };
    let wrapped = format!("EXPLAIN ({options}) {trimmed}");

    let mut conn = pool.acquire().await.map_err(DbError::from)?;
    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("SET search_path TO \"{schema_name}\""))
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
            message: "PostgreSQL EXPLAIN returned no rows".to_string(),
        })?;

    let parsed: serde_json::Value = row
        .try_get::<sqlx::types::Json<serde_json::Value>, _>(0)
        .map(|j| j.0)
        .or_else(|_| {
            row.try_get::<String, _>(0)
                .map_err(DbError::from)
                .and_then(|s| {
                    serde_json::from_str(&s).map_err(|e| DbError {
                        code: "EXPLAIN_PARSE_ERROR".to_string(),
                        message: format!("Failed to parse PG EXPLAIN JSON: {e}"),
                    })
                })
        })?;
    drop(stream);
    let raw = serde_json::to_string_pretty(&parsed).unwrap_or_default();
    let root = parse_postgres(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "postgresql",
        root,
        raw,
        analyze_ran: analyze,
        supports_analyze: true,
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
        "SELECT" | "WITH" | "VALUES" | "TABLE" | "SHOW" => Ok(()),
        _ => Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: format!(
                "Refusing to EXPLAIN ANALYZE on a {head} statement — it would execute. Turn off ANALYZE to see the estimated plan."
            ),
        }),
    }
}
