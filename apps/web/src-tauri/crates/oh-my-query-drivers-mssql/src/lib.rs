use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use base64::Engine as _;
use bb8::Pool as Bb8Pool;
use bb8_tiberius::ConnectionManager;
use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime};
use futures::TryStreamExt;
use oh_my_query_core::error::DbError;
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, IndexItem, SchemaInfo, SchemaItem,
    TableItem, TestConnectionResult, ViewItem,
};
use oh_my_query_core::{Driver, Pool};
use tiberius::{
    AuthMethod, Column, ColumnData, ColumnType, Config, EncryptionLevel, QueryItem, Row,
};

pub type MssqlPool = Bb8Pool<ConnectionManager>;

pub struct MssqlDriver;

pub fn build_mssql_config(params: &ConnectionParams) -> Config {
    let mut config = Config::new();
    config.host(&params.host);
    config.port(if params.port == 0 { 1433 } else { params.port });
    if !params.database.is_empty() {
        config.database(&params.database);
    }
    config.authentication(AuthMethod::sql_server(&params.username, &params.password));
    config.encryption(EncryptionLevel::Required);
    if params.trust_server_certificate.unwrap_or(false) {
        config.trust_cert();
    }
    config
}

pub async fn build_mssql_pool(params: &ConnectionParams) -> Result<MssqlPool, DbError> {
    let config = build_mssql_config(params);
    let manager = ConnectionManager::new(config);
    Bb8Pool::builder()
        .max_size(5)
        .connection_timeout(std::time::Duration::from_secs(10))
        .build(manager)
        .await
        .map_err(DbError::from)
}

pub struct MssqlPoolWrapper {
    pub pool: MssqlPool,
}

#[async_trait]
impl Driver for MssqlDriver {
    fn db_type(&self) -> &'static str {
        "mssql"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let start = Instant::now();
        let pool = build_mssql_pool(params).await?;
        let mut conn = pool.get().await.map_err(DbError::from)?;
        conn.simple_query("SELECT 1")
            .await
            .map_err(DbError::from)?
            .into_results()
            .await
            .map_err(DbError::from)?;
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
        let pool = build_mssql_pool(params).await?;

        {
            let mut conn = pool.get().await.map_err(DbError::from)?;
            conn.simple_query("SELECT 1")
                .await
                .map_err(DbError::from)?
                .into_results()
                .await
                .map_err(DbError::from)?;
        }

        Ok(Arc::new(MssqlPoolWrapper { pool }))
    }
}

#[async_trait]
impl Pool for MssqlPoolWrapper {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::TSQL)
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let mut client = self.pool.get().await.map_err(DbError::from)?;
        let rows = client
            .simple_query("SELECT @@VERSION")
            .await
            .map_err(DbError::from)?
            .into_results()
            .await
            .map_err(DbError::from)?;
        let ver = rows
            .into_iter()
            .flatten()
            .next()
            .and_then(|r| {
                r.try_get::<&str, _>(0)
                    .ok()
                    .flatten()
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "unknown".to_string());
        let first_line = ver.lines().next().unwrap_or("unknown").trim().to_string();
        Ok(first_line)
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        list_databases_mssql(&self.pool).await
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_mssql(&self.pool, database).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        _schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        execute_mssql(&self.pool, command, max_rows).await
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub async fn execute_mssql(
    pool: &MssqlPool,
    sql: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;
    let started = Instant::now();
    let mut stream = client
        .simple_query(sql.to_string())
        .await
        .map_err(DbError::from)?;

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
        execution_time_ms: started.elapsed().as_millis() as u64,
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
        | ColumnData::DateTime2(Some(_)) => row
            .try_get::<NaiveDateTime, _>(idx)
            .ok()
            .flatten()
            .map(|dt| serde_json::Value::String(dt.format("%Y-%m-%dT%H:%M:%S%.f").to_string()))
            .unwrap_or_else(|| fallback_debug(col, data)),
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

pub async fn list_databases_mssql(pool: &MssqlPool) -> Result<Vec<String>, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;
    let results = client
        .simple_query(
            "SELECT name FROM sys.schemas \
             WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner',\
             'db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator',\
             'db_datareader','db_datawriter','db_denydatareader','db_denydatawriter') \
             ORDER BY name",
        )
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();
    if names.is_empty() {
        Ok(vec!["dbo".to_string()])
    } else {
        Ok(names)
    }
}

pub async fn fetch_schema_mssql(
    pool: &MssqlPool,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;

    let tables = fetch_tables_mssql(&mut client, schema_name).await?;
    let views = fetch_views_mssql(&mut client, schema_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: schema_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let query = format!(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES \
         WHERE TABLE_SCHEMA = '{}' AND TABLE_TYPE = 'BASE TABLE' \
         ORDER BY TABLE_NAME",
        escape_mssql_literal(schema_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();

    let mut tables = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_mssql(client, schema_name, &name).await?;
        let indexes = fetch_indexes_mssql(client, schema_name, &name).await?;
        tables.push(TableItem {
            name,
            columns,
            indexes,
            foreign_keys: vec![],
            row_estimate: None,
        });
    }
    Ok(tables)
}

async fn fetch_views_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let query = format!(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS \
         WHERE TABLE_SCHEMA = '{}' ORDER BY TABLE_NAME",
        escape_mssql_literal(schema_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();

    let mut views = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_mssql(client, schema_name, &name).await?;
        views.push(ViewItem { name, columns });
    }
    Ok(views)
}

async fn fetch_columns_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let query = format!(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT \
         FROM INFORMATION_SCHEMA.COLUMNS \
         WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}' \
         ORDER BY ORDINAL_POSITION",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let pk_cols = fetch_primary_key_columns_mssql(client, schema_name, table_name).await?;

    let columns = results
        .into_iter()
        .flatten()
        .map(|row| {
            let name = row
                .try_get::<&str, _>(0)
                .ok()
                .flatten()
                .unwrap_or("")
                .to_string();
            let data_type = row
                .try_get::<&str, _>(1)
                .ok()
                .flatten()
                .unwrap_or("")
                .to_string();
            let nullable = row
                .try_get::<&str, _>(2)
                .ok()
                .flatten()
                .map(|s| s.eq_ignore_ascii_case("YES"))
                .unwrap_or(true);
            let default_value = row
                .try_get::<&str, _>(3)
                .ok()
                .flatten()
                .map(|s| s.to_string());
            ColumnDetail {
                is_primary_key: pk_cols.iter().any(|c| c == &name),
                name,
                data_type,
                is_nullable: nullable,
                default_value,
            }
        })
        .collect();
    Ok(columns)
}

async fn fetch_primary_key_columns_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<String>, DbError> {
    let query = format!(
        "SELECT kcu.COLUMN_NAME \
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc \
         JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu \
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME \
         AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA \
         WHERE tc.TABLE_SCHEMA = '{}' AND tc.TABLE_NAME = '{}' \
         AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY' \
         ORDER BY kcu.ORDINAL_POSITION",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;
    Ok(results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect())
}

async fn fetch_indexes_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let query = format!(
        "SELECT i.name, i.is_unique, c.name \
         FROM sys.indexes i \
         JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id \
         JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id \
         JOIN sys.tables t ON t.object_id = i.object_id \
         JOIN sys.schemas s ON s.schema_id = t.schema_id \
         WHERE s.name = '{}' AND t.name = '{}' AND i.is_hypothetical = 0 \
         ORDER BY i.name, ic.key_ordinal",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let mut map: std::collections::HashMap<String, (bool, Vec<String>)> =
        std::collections::HashMap::new();
    for row in results.into_iter().flatten() {
        let name = row
            .try_get::<&str, _>(0)
            .ok()
            .flatten()
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let is_unique = row.try_get::<bool, _>(1).ok().flatten().unwrap_or(false);
        let col = row
            .try_get::<&str, _>(2)
            .ok()
            .flatten()
            .unwrap_or("")
            .to_string();
        let entry = map.entry(name).or_insert((is_unique, Vec::new()));
        entry.1.push(col);
    }

    Ok(map
        .into_iter()
        .map(|(name, (is_unique, columns))| IndexItem {
            name,
            columns,
            is_unique,
        })
        .collect())
}

fn escape_mssql_literal(input: &str) -> String {
    input.replace('\'', "''")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_params() -> ConnectionParams {
        ConnectionParams {
            db_type: "mssql".to_string(),
            host: "localhost".to_string(),
            port: 1433,
            database: "master".to_string(),
            username: "sa".to_string(),
            password: "Secret123".to_string(),
            auth_source: None,
            trust_server_certificate: None,
        }
    }

    #[test]
    fn config_sets_host_and_port() {
        let params = base_params();
        let cfg = build_mssql_config(&params);
        let addr = cfg.get_addr();
        assert!(addr.contains("localhost"));
        assert!(addr.ends_with(":1433"));
    }

    #[test]
    fn config_defaults_port_when_zero() {
        let mut params = base_params();
        params.port = 0;
        let cfg = build_mssql_config(&params);
        assert!(cfg.get_addr().ends_with(":1433"));
    }

    #[test]
    fn config_honors_non_default_port() {
        let mut params = base_params();
        params.port = 1434;
        let cfg = build_mssql_config(&params);
        assert!(cfg.get_addr().ends_with(":1434"));
    }

    #[test]
    fn config_omits_database_when_empty() {
        let mut params = base_params();
        params.database = String::new();
        let _cfg = build_mssql_config(&params);
    }

    #[test]
    fn config_accepts_explicit_trust_setting() {
        let mut params = base_params();
        params.trust_server_certificate = Some(false);
        let _cfg = build_mssql_config(&params);
        params.trust_server_certificate = Some(true);
        let _cfg = build_mssql_config(&params);
    }

    #[test]
    fn config_does_not_trust_when_flag_unset() {
        let params = base_params();
        assert!(params.trust_server_certificate.is_none());
        let _cfg = build_mssql_config(&params);
    }

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
