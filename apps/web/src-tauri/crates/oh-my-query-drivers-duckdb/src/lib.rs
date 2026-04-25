use std::any::Any;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use base64::Engine as _;
use duckdb::types::Value as DuckValue;
use oh_my_query_core::error::DbError;
use oh_my_query_core::explain::{parser::parse_duckdb, ExplainResult};
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, SchemaInfo, SchemaItem, TableItem,
    TestConnectionResult, ViewItem,
};
use oh_my_query_core::{Driver, Pool};
use tokio::sync::Mutex;

pub type DuckDbHandle = Arc<Mutex<duckdb::Connection>>;

pub struct DuckDbDriver;

pub fn resolve_database_target(raw: &str) -> Result<String, DbError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case(":memory:") {
        return Ok(":memory:".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(DbError {
            code: "DUCKDB_INVALID_PATH".to_string(),
            message: format!(
                "DuckDB database path must be absolute or ':memory:' (got '{trimmed}')"
            ),
        });
    }
    Ok(trimmed.to_string())
}

pub fn open_duckdb(params: &ConnectionParams) -> Result<duckdb::Connection, DbError> {
    let target = resolve_database_target(&params.database)?;
    if target == ":memory:" {
        duckdb::Connection::open_in_memory().map_err(DbError::from)
    } else {
        duckdb::Connection::open(&target).map_err(DbError::from)
    }
}

pub struct DuckDbPool {
    pub handle: DuckDbHandle,
}

#[async_trait]
impl Driver for DuckDbDriver {
    fn db_type(&self) -> &'static str {
        "duckdb"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let start = Instant::now();
        let params = params.clone();
        tokio::task::spawn_blocking(move || -> Result<(), DbError> {
            let conn = open_duckdb(&params)?;
            conn.execute_batch("SELECT 1").map_err(DbError::from)?;
            Ok(())
        })
        .await
        .map_err(|e| DbError {
            code: "DUCKDB_JOIN_ERROR".to_string(),
            message: e.to_string(),
        })??;

        let latency = start.elapsed().as_millis() as u64;
        Ok(TestConnectionResult {
            success: true,
            message: "Connection successful".to_string(),
            latency_ms: latency,
        })
    }

    async fn connect(
        &self,
        _id: &str,
        params: &ConnectionParams,
    ) -> Result<Arc<dyn Pool>, DbError> {
        let params = params.clone();
        let conn = tokio::task::spawn_blocking(move || open_duckdb(&params))
            .await
            .map_err(|e| DbError {
                code: "DUCKDB_JOIN_ERROR".to_string(),
                message: e.to_string(),
            })??;

        let handle: DuckDbHandle = Arc::new(Mutex::new(conn));

        let verify = handle.clone();
        tokio::task::spawn_blocking(move || -> Result<(), DbError> {
            let conn = verify.blocking_lock();
            conn.execute_batch("SELECT 1").map_err(DbError::from)
        })
        .await
        .map_err(|e| DbError {
            code: "DUCKDB_JOIN_ERROR".to_string(),
            message: e.to_string(),
        })??;

        Ok(Arc::new(DuckDbPool { handle }))
    }
}

#[async_trait]
impl Pool for DuckDbPool {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::DuckDB)
    }

    fn supports_explain(&self) -> bool {
        true
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let handle = self.handle.clone();
        let ver = tokio::task::spawn_blocking(move || -> Result<String, DbError> {
            let conn = handle.blocking_lock();
            let v: String = conn
                .query_row("SELECT version()", [], |row| row.get(0))
                .map_err(DbError::from)?;
            Ok(v)
        })
        .await
        .map_err(|e| DbError {
            code: "DUCKDB_JOIN_ERROR".to_string(),
            message: e.to_string(),
        })??;
        Ok(format!("DuckDB {ver}"))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        list_databases_duckdb(&self.handle).await
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_duckdb(&self.handle, database).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        _schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        execute_duckdb(&self.handle, command, max_rows).await
    }

    async fn explain(
        &self,
        sql: &str,
        analyze: bool,
        _schema: Option<&str>,
    ) -> Result<ExplainResult, DbError> {
        explain_duckdb(&self.handle, sql, analyze).await
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub async fn execute_duckdb(
    handle: &DuckDbHandle,
    sql: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    let handle = handle.clone();
    let sql = sql.to_string();
    tokio::task::spawn_blocking(move || run_query(&handle, &sql, max_rows))
        .await
        .map_err(|e| DbError {
            code: "DUCKDB_JOIN_ERROR".to_string(),
            message: e.to_string(),
        })?
}

fn run_query(handle: &DuckDbHandle, sql: &str, max_rows: usize) -> Result<ExecuteResult, DbError> {
    let conn = handle.blocking_lock();
    let started = Instant::now();

    let mut stmt = conn.prepare(sql).map_err(DbError::from)?;
    let mut rows_iter = stmt.query([]).map_err(DbError::from)?;

    let (column_count, columns) = rows_iter
        .as_ref()
        .map(|s| {
            let count = s.column_count();
            let infos = (0..count)
                .map(|i| ColumnInfo {
                    name: s.column_name(i).map(|n| n.to_string()).unwrap_or_default(),
                    type_name: format!("{:?}", s.column_type(i)),
                })
                .collect::<Vec<_>>();
            (count, infos)
        })
        .unwrap_or((0, Vec::new()));

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut is_truncated = false;

    while let Some(row) = rows_iter.next().map_err(DbError::from)? {
        if rows.len() >= max_rows {
            is_truncated = true;
            break;
        }
        let mut out = Vec::with_capacity(column_count);
        for i in 0..column_count {
            let v: DuckValue = row.get(i).map_err(DbError::from)?;
            out.push(duckdb_value_to_json(v));
        }
        rows.push(out);
    }

    Ok(ExecuteResult::Tabular {
        row_count: rows.len() as u64,
        columns,
        rows,
        execution_time_ms: started.elapsed().as_millis() as u64,
        is_truncated,
    })
}

pub fn duckdb_value_to_json(value: DuckValue) -> serde_json::Value {
    match value {
        DuckValue::Null => serde_json::Value::Null,
        DuckValue::Boolean(b) => serde_json::Value::Bool(b),
        DuckValue::TinyInt(v) => serde_json::json!(v),
        DuckValue::SmallInt(v) => serde_json::json!(v),
        DuckValue::Int(v) => serde_json::json!(v),
        DuckValue::BigInt(v) => serde_json::json!(v),
        DuckValue::HugeInt(v) => serde_json::Value::String(v.to_string()),
        DuckValue::UTinyInt(v) => serde_json::json!(v),
        DuckValue::USmallInt(v) => serde_json::json!(v),
        DuckValue::UInt(v) => serde_json::json!(v),
        DuckValue::UBigInt(v) => serde_json::json!(v),
        DuckValue::Float(v) => serde_json::json!(v),
        DuckValue::Double(v) => serde_json::json!(v),
        DuckValue::Decimal(v) => serde_json::Value::String(v.to_string()),
        DuckValue::Text(s) => serde_json::Value::String(s),
        DuckValue::Blob(bytes) => {
            serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(bytes))
        }
        DuckValue::Date32(days) => serde_json::Value::String(format_date_days(days)),
        DuckValue::Time64(unit, v) => serde_json::Value::String(format_time_unit(unit, v)),
        DuckValue::Timestamp(unit, v) => serde_json::Value::String(format_timestamp_unit(unit, v)),
        DuckValue::Interval {
            months,
            days,
            nanos,
        } => serde_json::Value::String(format!("{months}mo {days}d {nanos}ns")),
        DuckValue::List(items) => {
            let mapped: Vec<serde_json::Value> =
                items.into_iter().map(duckdb_value_to_json).collect();
            serde_json::Value::Array(mapped)
        }
        DuckValue::Array(items) => {
            let mapped: Vec<serde_json::Value> =
                items.into_iter().map(duckdb_value_to_json).collect();
            serde_json::Value::Array(mapped)
        }
        DuckValue::Struct(fields) => {
            let map: serde_json::Map<String, serde_json::Value> = fields
                .iter()
                .map(|(k, v)| (k.clone(), duckdb_value_to_json(v.clone())))
                .collect();
            serde_json::Value::Object(map)
        }
        DuckValue::Map(entries) => {
            let arr: Vec<serde_json::Value> = entries
                .iter()
                .map(|(k, v)| {
                    serde_json::json!({
                        "key": duckdb_value_to_json(k.clone()),
                        "value": duckdb_value_to_json(v.clone()),
                    })
                })
                .collect();
            serde_json::Value::Array(arr)
        }
        DuckValue::Enum(s) => serde_json::Value::String(s),
        DuckValue::Union(inner) => duckdb_value_to_json(*inner),
    }
}

fn format_date_days(days: i32) -> String {
    use chrono::{Duration, NaiveDate};
    let epoch = NaiveDate::from_ymd_opt(1970, 1, 1).unwrap();
    let date = epoch
        .checked_add_signed(Duration::days(days as i64))
        .unwrap_or(epoch);
    date.format("%Y-%m-%d").to_string()
}

fn format_time_unit(unit: duckdb::types::TimeUnit, v: i64) -> String {
    use duckdb::types::TimeUnit;
    let nanos = match unit {
        TimeUnit::Second => v.saturating_mul(1_000_000_000),
        TimeUnit::Millisecond => v.saturating_mul(1_000_000),
        TimeUnit::Microsecond => v.saturating_mul(1_000),
        TimeUnit::Nanosecond => v,
    };
    let total_micros = nanos / 1_000;
    let seconds = total_micros / 1_000_000;
    let micros = total_micros % 1_000_000;
    let h = seconds / 3600;
    let m = (seconds / 60) % 60;
    let s = seconds % 60;
    format!("{h:02}:{m:02}:{s:02}.{micros:06}")
}

fn format_timestamp_unit(unit: duckdb::types::TimeUnit, v: i64) -> String {
    use chrono::DateTime;
    use duckdb::types::TimeUnit;
    let nanos_per_unit: i64 = match unit {
        TimeUnit::Second => 1_000_000_000,
        TimeUnit::Millisecond => 1_000_000,
        TimeUnit::Microsecond => 1_000,
        TimeUnit::Nanosecond => 1,
    };
    let total_nanos = (v as i128) * (nanos_per_unit as i128);
    let secs = (total_nanos / 1_000_000_000) as i64;
    let nsecs = (total_nanos.rem_euclid(1_000_000_000)) as u32;
    match DateTime::from_timestamp(secs, nsecs) {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S%.f").to_string(),
        None => format!("{v}"),
    }
}

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

pub async fn list_databases_duckdb(handle: &DuckDbHandle) -> Result<Vec<String>, DbError> {
    let handle = handle.clone();
    tokio::task::spawn_blocking(move || -> Result<Vec<String>, DbError> {
        let conn = handle.try_lock().map_err(|_| DbError {
            code: "DUCKDB_BUSY".to_string(),
            message: "DuckDB connection is busy".to_string(),
        })?;
        let mut stmt = conn
            .prepare(
                "SELECT schema_name FROM duckdb_schemas() \
                 WHERE NOT internal ORDER BY schema_name",
            )
            .map_err(DbError::from)?;
        let names = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(DbError::from)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        if names.is_empty() {
            Ok(vec!["main".to_string()])
        } else {
            Ok(names)
        }
    })
    .await
    .map_err(|e| DbError {
        code: "DUCKDB_JOIN_ERROR".to_string(),
        message: e.to_string(),
    })?
}

pub async fn fetch_schema_duckdb(
    handle: &DuckDbHandle,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let handle = handle.clone();
    let schema = schema_name.to_string();
    tokio::task::spawn_blocking(move || -> Result<SchemaInfo, DbError> {
        let conn = handle.try_lock().map_err(|_| DbError {
            code: "DUCKDB_BUSY".to_string(),
            message: "DuckDB connection is busy".to_string(),
        })?;

        let tables = fetch_tables_duckdb(&conn, &schema)?;
        let views = fetch_views_duckdb(&conn, &schema)?;

        Ok(SchemaInfo {
            schemas: vec![SchemaItem {
                name: schema,
                tables,
                views,
            }],
        })
    })
    .await
    .map_err(|e| DbError {
        code: "DUCKDB_JOIN_ERROR".to_string(),
        message: e.to_string(),
    })?
}

fn fetch_tables_duckdb(conn: &duckdb::Connection, schema: &str) -> Result<Vec<TableItem>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name, estimated_size FROM duckdb_tables() \
             WHERE schema_name = ? AND NOT temporary AND NOT internal \
             ORDER BY table_name",
        )
        .map_err(DbError::from)?;

    let rows = stmt
        .query_map([schema], |row| {
            let name: String = row.get(0)?;
            let estimate: Option<i64> = row.get::<_, Option<i64>>(1).ok().flatten();
            Ok((name, estimate))
        })
        .map_err(DbError::from)?;

    let mut tables = Vec::new();
    for row in rows {
        let (name, estimate) = row.map_err(DbError::from)?;
        let columns = fetch_columns_duckdb(conn, schema, &name)?;
        tables.push(TableItem {
            name,
            columns,
            indexes: vec![],
            foreign_keys: vec![],
            row_estimate: estimate.and_then(|v| u64::try_from(v).ok()),
        });
    }
    Ok(tables)
}

fn fetch_views_duckdb(conn: &duckdb::Connection, schema: &str) -> Result<Vec<ViewItem>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT view_name FROM duckdb_views() \
             WHERE schema_name = ? AND NOT internal ORDER BY view_name",
        )
        .map_err(DbError::from)?;

    let names = stmt
        .query_map([schema], |row| row.get::<_, String>(0))
        .map_err(DbError::from)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(DbError::from)?;

    let mut views = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_duckdb(conn, schema, &name)?;
        views.push(ViewItem { name, columns });
    }
    Ok(views)
}

fn fetch_columns_duckdb(
    conn: &duckdb::Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let pk_cols = fetch_primary_key_columns_duckdb(conn, schema, table)?;

    let mut stmt = conn
        .prepare(
            "SELECT column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
        )
        .map_err(DbError::from)?;

    let rows = stmt
        .query_map([schema, table], |row| {
            let name: String = row.get(0)?;
            let data_type: String = row.get(1)?;
            let nullable = row
                .get::<_, String>(2)
                .map(|s| s.eq_ignore_ascii_case("YES"))
                .unwrap_or(true);
            let default_value = row.get::<_, Option<String>>(3).ok().flatten();
            Ok(ColumnDetail {
                is_primary_key: pk_cols.iter().any(|c| c == &name),
                name,
                data_type,
                is_nullable: nullable,
                default_value,
            })
        })
        .map_err(DbError::from)?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(DbError::from)
}

fn fetch_primary_key_columns_duckdb(
    conn: &duckdb::Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<String>, DbError> {
    let Ok(mut stmt) = conn.prepare(
        "SELECT UNNEST(constraint_column_names) FROM duckdb_constraints() \
         WHERE schema_name = ? AND table_name = ? AND constraint_type = 'PRIMARY KEY'",
    ) else {
        return Ok(Vec::new());
    };

    let Ok(rows) = stmt.query_map([schema, table], |row| row.get::<_, String>(0)) else {
        return Ok(Vec::new());
    };

    Ok(rows.flatten().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params_for(database: &str) -> ConnectionParams {
        ConnectionParams {
            db_type: "duckdb".to_string(),
            host: String::new(),
            port: 0,
            database: database.to_string(),
            username: String::new(),
            password: String::new(),
            auth_source: None,
            trust_server_certificate: None,
        }
    }

    #[test]
    fn empty_database_maps_to_memory() {
        assert_eq!(resolve_database_target("").unwrap(), ":memory:");
        assert_eq!(resolve_database_target("   ").unwrap(), ":memory:");
    }

    #[test]
    fn memory_literal_accepted_case_insensitively() {
        assert_eq!(resolve_database_target(":memory:").unwrap(), ":memory:");
        assert_eq!(resolve_database_target(":Memory:").unwrap(), ":memory:");
    }

    #[test]
    fn absolute_path_accepted() {
        let r = resolve_database_target("/tmp/oh-my-query-test.duckdb").unwrap();
        assert_eq!(r, "/tmp/oh-my-query-test.duckdb");
    }

    #[test]
    fn relative_path_rejected() {
        let err = resolve_database_target("relative/path.duckdb").unwrap_err();
        assert_eq!(err.code, "DUCKDB_INVALID_PATH");
    }

    #[test]
    fn in_memory_roundtrip() {
        let params = params_for(":memory:");
        let conn = open_duckdb(&params).unwrap();
        let mut stmt = conn.prepare("SELECT 1").unwrap();
        let mut rows = stmt.query([]).unwrap();
        let row = rows.next().unwrap().unwrap();
        let v: i32 = row.get(0).unwrap();
        assert_eq!(v, 1);
    }

    #[test]
    fn primitives_map_to_json() {
        assert_eq!(
            duckdb_value_to_json(DuckValue::Null),
            serde_json::Value::Null
        );
        assert_eq!(
            duckdb_value_to_json(DuckValue::Boolean(true)),
            serde_json::Value::Bool(true)
        );
        assert_eq!(
            duckdb_value_to_json(DuckValue::Int(42)),
            serde_json::json!(42)
        );
        assert_eq!(
            duckdb_value_to_json(DuckValue::Text("hi".to_string())),
            serde_json::Value::String("hi".to_string())
        );
    }

    #[test]
    fn lists_map_to_arrays() {
        let v = DuckValue::List(vec![DuckValue::Int(1), DuckValue::Int(2)]);
        assert_eq!(duckdb_value_to_json(v), serde_json::json!([1, 2]));
    }

    #[test]
    fn structs_map_to_objects() {
        let v = DuckValue::Struct(duckdb::types::OrderedMap::from(vec![
            ("a".to_string(), DuckValue::Int(1)),
            ("b".to_string(), DuckValue::Text("x".to_string())),
        ]));
        assert_eq!(
            duckdb_value_to_json(v),
            serde_json::json!({"a": 1, "b": "x"})
        );
    }

    #[test]
    fn blob_base64_encoded() {
        let v = DuckValue::Blob(vec![1, 2, 3]);
        assert_eq!(
            duckdb_value_to_json(v),
            serde_json::Value::String("AQID".to_string())
        );
    }

    #[test]
    fn date_formatted_iso() {
        assert_eq!(format_date_days(0), "1970-01-01");
        assert_eq!(format_date_days(365), "1971-01-01");
    }
}
