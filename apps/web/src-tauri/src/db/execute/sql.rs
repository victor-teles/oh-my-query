use futures::TryStreamExt;

use crate::db::error::DbError;
use crate::db::pool::DatabasePool;
use crate::db::types::ColumnInfo;

macro_rules! fetch_rows_native {
    ($pool:expr, $sql:expr, $max_rows:expr) => {{
        use sqlx::{Column, Row, TypeInfo, ValueRef};

        let mut stream = sqlx::raw_sql($sql).fetch($pool);
        let mut columns: Option<Vec<ColumnInfo>> = None;
        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut is_truncated = false;

        while let Some(row) = stream.try_next().await.map_err(DbError::from)? {
            if columns.is_none() {
                let cols = row.columns();
                let mut col_info = Vec::with_capacity(cols.len());
                for col in cols {
                    col_info.push(ColumnInfo {
                        name: col.name().to_string(),
                        type_name: col.type_info().name().to_string(),
                    });
                }
                columns = Some(col_info);
            }

            if rows.len() >= $max_rows {
                is_truncated = true;
                break;
            }

            let num_cols = row.columns().len();
            let mut vals = Vec::with_capacity(num_cols);
            for idx in 0..num_cols {
                let type_name = row.column(idx).type_info().name().to_uppercase();

                if row.try_get_raw(idx).is_ok_and(|v| v.is_null()) {
                    vals.push(serde_json::Value::Null);
                    continue;
                }

                let val = match type_name.as_str() {
                    "BOOL" | "BOOLEAN" => row
                        .try_get::<bool, _>(idx)
                        .map(serde_json::Value::Bool)
                        .unwrap_or(serde_json::Value::Null),

                    "INT2" | "SMALLINT" | "INT4" | "INT" | "INTEGER" | "INT8" | "BIGINT"
                    | "TINYINT" | "MEDIUMINT" => row
                        .try_get::<i64, _>(idx)
                        .map(|v: i64| serde_json::Value::Number(v.into()))
                        .unwrap_or(serde_json::Value::Null),

                    "FLOAT4" | "FLOAT8" | "REAL" | "DOUBLE" | "DOUBLE PRECISION" | "NUMERIC"
                    | "DECIMAL" | "FLOAT" => row
                        .try_get::<f64, _>(idx)
                        .ok()
                        .and_then(|v| {
                            serde_json::Number::from_f64(v).map(serde_json::Value::Number)
                        })
                        .unwrap_or(serde_json::Value::Null),

                    _ => row
                        .try_get::<String, _>(idx)
                        .map(serde_json::Value::String)
                        .unwrap_or(serde_json::Value::Null),
                };
                vals.push(val);
            }
            rows.push(vals);
        }

        Ok::<_, DbError>((columns.unwrap_or_default(), rows, is_truncated))
    }};
}

fn validate_schema_name(name: &str) -> Result<(), DbError> {
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(DbError {
            code: "INVALID_SCHEMA".to_string(),
            message: format!("Invalid schema name: {name}"),
        });
    }
    Ok(())
}

pub async fn fetch_sql_rows(
    pool: &DatabasePool,
    sql: &str,
    max_rows: usize,
    schema: Option<&str>,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let mut conn = pool.acquire().await.map_err(DbError::from)?;
            if let Some(schema_name) = schema {
                validate_schema_name(schema_name)?;
                sqlx::query(&format!("SET search_path TO \"{}\"", schema_name))
                    .execute(&mut *conn)
                    .await
                    .map_err(DbError::from)?;
            }
            fetch_rows_native!(&mut *conn, sql, max_rows)
        }
        DatabasePool::MySql(pool) => {
            let mut conn = pool.acquire().await.map_err(DbError::from)?;
            if let Some(schema_name) = schema {
                validate_schema_name(schema_name)?;
                sqlx::query(&format!("USE `{}`", schema_name))
                    .execute(&mut *conn)
                    .await
                    .map_err(DbError::from)?;
            }
            fetch_rows_native!(&mut *conn, sql, max_rows)
        }
        DatabasePool::Sqlite(pool) => fetch_rows_native!(pool, sql, max_rows),
        _ => unreachable!(),
    }
}
