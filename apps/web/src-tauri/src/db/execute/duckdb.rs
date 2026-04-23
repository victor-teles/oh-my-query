use base64::Engine as _;
use duckdb::types::Value as DuckValue;

use crate::db::duckdb::DuckDbHandle;
use crate::db::error::DbError;
use crate::db::types::{ColumnInfo, ExecuteResult};

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
    let conn = handle.try_lock().map_err(|_| DbError {
        code: "DUCKDB_BUSY".to_string(),
        message: "Another query is currently running on this DuckDB connection".to_string(),
    })?;

    let mut stmt = conn.prepare(sql).map_err(DbError::from)?;
    let column_count = stmt.column_count();
    let columns: Vec<ColumnInfo> = (0..column_count)
        .map(|i| ColumnInfo {
            name: stmt
                .column_name(i)
                .map(|s| s.to_string())
                .unwrap_or_default(),
            type_name: format!("{:?}", stmt.column_type(i)),
        })
        .collect();

    let mut rows_iter = stmt.query([]).map_err(DbError::from)?;
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
        execution_time_ms: 0,
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

#[cfg(test)]
mod tests {
    use super::*;

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
