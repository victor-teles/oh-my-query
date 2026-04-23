use base64::Engine as _;
use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime};
use futures::TryStreamExt;
use tiberius::{Column, ColumnData, ColumnType, QueryItem, Row};

use crate::db::error::DbError;
use crate::db::mssql::MssqlPool;
use crate::db::types::{ColumnInfo, ExecuteResult};

pub async fn execute_mssql(
    pool: &MssqlPool,
    sql: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;
    let mut stream = client.simple_query(sql.to_string()).await.map_err(DbError::from)?;

    let mut columns: Vec<ColumnInfo> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut is_truncated = false;

    while let Some(item) = stream.try_next().await.map_err(DbError::from)? {
        match item {
            QueryItem::Metadata(meta) => {
                if columns.is_empty() {
                    columns = meta
                        .columns()
                        .iter()
                        .map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            type_name: column_type_name(col.column_type()).to_string(),
                        })
                        .collect();
                }
            }
            QueryItem::Row(row) => {
                if rows.len() >= max_rows {
                    is_truncated = true;
                    continue;
                }
                rows.push(row_to_json(&row));
            }
        }
    }

    Ok(ExecuteResult::Tabular {
        row_count: rows.len() as u64,
        columns,
        rows,
        execution_time_ms: 0,
        is_truncated,
    })
}

fn row_to_json(row: &Row) -> Vec<serde_json::Value> {
    let mut out = Vec::with_capacity(row.len());
    for (idx, (col, data)) in row.cells().enumerate() {
        out.push(cell_to_json(col, data, row, idx));
    }
    out
}

fn cell_to_json(
    col: &Column,
    data: &ColumnData<'static>,
    row: &Row,
    idx: usize,
) -> serde_json::Value {
    match data {
        ColumnData::U8(Some(v)) => serde_json::json!(v),
        ColumnData::I16(Some(v)) => serde_json::json!(v),
        ColumnData::I32(Some(v)) => serde_json::json!(v),
        ColumnData::I64(Some(v)) => serde_json::json!(v),
        ColumnData::F32(Some(v)) => serde_json::json!(v),
        ColumnData::F64(Some(v)) => serde_json::json!(v),
        ColumnData::Bit(Some(v)) => serde_json::Value::Bool(*v),
        ColumnData::String(Some(s)) => serde_json::Value::String(s.to_string()),
        ColumnData::Guid(Some(uuid)) => serde_json::Value::String(uuid.to_string()),
        ColumnData::Binary(Some(bytes)) => serde_json::Value::String(
            base64::engine::general_purpose::STANDARD.encode(bytes.as_ref()),
        ),
        ColumnData::Numeric(Some(n)) => serde_json::Value::String(n.to_string()),
        ColumnData::Xml(Some(xml)) => serde_json::Value::String(xml.as_ref().to_string()),
        ColumnData::DateTime(Some(_))
        | ColumnData::SmallDateTime(Some(_))
        | ColumnData::DateTime2(Some(_)) => {
            row.try_get::<NaiveDateTime, _>(idx)
                .ok()
                .flatten()
                .map(|dt| serde_json::Value::String(dt.format("%Y-%m-%dT%H:%M:%S%.f").to_string()))
                .unwrap_or_else(|| fallback_debug(col, data))
        }
        ColumnData::Date(Some(_)) => row
            .try_get::<NaiveDate, _>(idx)
            .ok()
            .flatten()
            .map(|d| serde_json::Value::String(d.format("%Y-%m-%d").to_string()))
            .unwrap_or_else(|| fallback_debug(col, data)),
        ColumnData::Time(Some(_)) => row
            .try_get::<NaiveTime, _>(idx)
            .ok()
            .flatten()
            .map(|t| serde_json::Value::String(t.format("%H:%M:%S%.f").to_string()))
            .unwrap_or_else(|| fallback_debug(col, data)),
        ColumnData::DateTimeOffset(Some(_)) => row
            .try_get::<DateTime<FixedOffset>, _>(idx)
            .ok()
            .flatten()
            .map(|dt| serde_json::Value::String(dt.to_rfc3339()))
            .unwrap_or_else(|| fallback_debug(col, data)),
        ColumnData::U8(None)
        | ColumnData::I16(None)
        | ColumnData::I32(None)
        | ColumnData::I64(None)
        | ColumnData::F32(None)
        | ColumnData::F64(None)
        | ColumnData::Bit(None)
        | ColumnData::String(None)
        | ColumnData::Guid(None)
        | ColumnData::Binary(None)
        | ColumnData::Numeric(None)
        | ColumnData::Xml(None)
        | ColumnData::DateTime(None)
        | ColumnData::SmallDateTime(None)
        | ColumnData::DateTime2(None)
        | ColumnData::Date(None)
        | ColumnData::Time(None)
        | ColumnData::DateTimeOffset(None) => serde_json::Value::Null,
    }
}

fn fallback_debug(_col: &Column, data: &ColumnData<'static>) -> serde_json::Value {
    serde_json::Value::String(format!("{data:?}"))
}

pub fn column_type_name(t: ColumnType) -> &'static str {
    match t {
        ColumnType::Null => "null",
        ColumnType::Bit | ColumnType::Bitn => "bit",
        ColumnType::Int1 => "tinyint",
        ColumnType::Int2 => "smallint",
        ColumnType::Int4 => "int",
        ColumnType::Int8 => "bigint",
        ColumnType::Intn => "int",
        ColumnType::Float4 | ColumnType::Floatn => "float",
        ColumnType::Float8 => "double",
        ColumnType::Money | ColumnType::Money4 => "money",
        ColumnType::Datetime | ColumnType::Datetime4 | ColumnType::Datetimen => "datetime",
        ColumnType::Datetime2 => "datetime2",
        ColumnType::Daten => "date",
        ColumnType::Timen => "time",
        ColumnType::DatetimeOffsetn => "datetimeoffset",
        ColumnType::Guid => "uniqueidentifier",
        ColumnType::Decimaln | ColumnType::Numericn => "numeric",
        ColumnType::BigVarBin | ColumnType::BigBinary => "varbinary",
        ColumnType::BigVarChar | ColumnType::BigChar => "varchar",
        ColumnType::NVarchar | ColumnType::NChar => "nvarchar",
        ColumnType::Xml => "xml",
        ColumnType::Udt => "udt",
        ColumnType::Text => "text",
        ColumnType::NText => "ntext",
        ColumnType::Image => "image",
        ColumnType::SSVariant => "sql_variant",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn column_type_name_maps_common_types() {
        assert_eq!(column_type_name(ColumnType::Int4), "int");
        assert_eq!(column_type_name(ColumnType::Int8), "bigint");
        assert_eq!(column_type_name(ColumnType::Bit), "bit");
        assert_eq!(column_type_name(ColumnType::BigVarChar), "varchar");
        assert_eq!(column_type_name(ColumnType::NVarchar), "nvarchar");
        assert_eq!(column_type_name(ColumnType::Guid), "uniqueidentifier");
        assert_eq!(column_type_name(ColumnType::Datetime2), "datetime2");
    }
}
