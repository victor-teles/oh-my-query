use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use oh_my_query_core::error::DbError;
use oh_my_query_core::explain::{parser::parse_clickhouse, ExplainResult};
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, IndexItem, SchemaInfo, SchemaItem,
    TableItem, TestConnectionResult, ViewItem,
};
use oh_my_query_core::{Driver, Pool};
use serde::Deserialize;

#[derive(Clone)]
pub struct ClickHouseConnection {
    client: reqwest::Client,
    base_url: String,
    database: String,
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct ClickHouseResponse {
    meta: Vec<ClickHouseMeta>,
    data: Vec<serde_json::Map<String, serde_json::Value>>,
    #[allow(dead_code)]
    rows: u64,
    #[allow(dead_code)]
    statistics: Option<ClickHouseStatistics>,
}

#[derive(Deserialize)]
struct ClickHouseMeta {
    name: String,
    #[serde(rename = "type")]
    type_name: String,
}

#[derive(Deserialize)]
struct ClickHouseStatistics {
    #[allow(dead_code)]
    elapsed: Option<f64>,
}

impl ClickHouseConnection {
    pub fn new(params: &ConnectionParams) -> Result<Self, DbError> {
        let scheme = if params.port == 8443 { "https" } else { "http" };
        let base_url = format!("{scheme}://{}:{}", params.host, params.port);

        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| DbError {
                code: "CLICKHOUSE_ERROR".to_string(),
                message: format!("Failed to create HTTP client: {e}"),
            })?;

        Ok(Self {
            client,
            base_url,
            database: params.database.clone(),
            username: params.username.clone(),
            password: params.password.clone(),
        })
    }

    async fn execute_mutation(
        &self,
        sql: &str,
        database_override: Option<&str>,
    ) -> Result<(), DbError> {
        let db = database_override.unwrap_or(&self.database);

        let mut request = self
            .client
            .post(&self.base_url)
            .query(&[("database", db)])
            .body(sql.to_string());

        if !self.username.is_empty() {
            request = request.basic_auth(&self.username, Some(&self.password));
        }

        let response = request.send().await.map_err(DbError::from)?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(DbError {
                code: "CLICKHOUSE_ERROR".to_string(),
                message: body,
            });
        }

        Ok(())
    }

    pub async fn query(
        &self,
        sql: &str,
        database_override: Option<&str>,
        max_rows: Option<usize>,
    ) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, u64, bool), DbError> {
        let sql_clean = sql.trim().trim_end_matches(';').trim();

        if !is_data_query(sql_clean) {
            self.execute_mutation(sql_clean, database_override).await?;
            return Ok((vec![], vec![], 0, false));
        }

        let db = database_override.unwrap_or(&self.database);
        let query_with_format = format!("{sql_clean} FORMAT JSON");

        let mut request = self
            .client
            .post(&self.base_url)
            .query(&[("database", db)])
            .body(query_with_format);

        if !self.username.is_empty() {
            request = request.basic_auth(&self.username, Some(&self.password));
        }

        if let Some(max) = max_rows {
            request = request.query(&[
                ("max_result_rows", (max + 1).to_string()),
                ("result_overflow_mode", "break".to_string()),
            ]);
        }

        let response = request.send().await.map_err(DbError::from)?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(DbError {
                code: "CLICKHOUSE_ERROR".to_string(),
                message: body,
            });
        }

        let ch_response: ClickHouseResponse = response.json().await.map_err(|e| DbError {
            code: "CLICKHOUSE_ERROR".to_string(),
            message: format!("Failed to parse ClickHouse response: {e}"),
        })?;

        let columns: Vec<ColumnInfo> = ch_response
            .meta
            .iter()
            .map(|m| ColumnInfo {
                name: m.name.clone(),
                type_name: m.type_name.clone(),
            })
            .collect();

        let column_names: Vec<&str> = ch_response.meta.iter().map(|m| m.name.as_str()).collect();

        let mut is_truncated = false;
        let data_len = ch_response.data.len();
        let row_limit = max_rows.unwrap_or(usize::MAX);
        let take_count = if data_len > row_limit {
            is_truncated = true;
            row_limit
        } else {
            data_len
        };

        let rows: Vec<Vec<serde_json::Value>> = ch_response
            .data
            .into_iter()
            .take(take_count)
            .map(|row_obj| {
                column_names
                    .iter()
                    .map(|col_name| {
                        let val = row_obj
                            .get(*col_name)
                            .cloned()
                            .unwrap_or(serde_json::Value::Null);
                        normalize_value(val)
                    })
                    .collect()
            })
            .collect();

        let row_count = rows.len() as u64;
        Ok((columns, rows, row_count, is_truncated))
    }

    pub async fn ping(&self) -> Result<(), DbError> {
        let mut request = self
            .client
            .post(&self.base_url)
            .query(&[("database", &self.database)])
            .body("SELECT 1 FORMAT JSON");

        if !self.username.is_empty() {
            request = request.basic_auth(&self.username, Some(&self.password));
        }

        let response = request.send().await.map_err(DbError::from)?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(DbError {
                code: "CLICKHOUSE_ERROR".to_string(),
                message: body,
            });
        }

        Ok(())
    }
}

fn is_data_query(sql: &str) -> bool {
    let upper = sql.trim_start().to_uppercase();
    upper.starts_with("SELECT")
        || upper.starts_with("SHOW")
        || upper.starts_with("DESCRIBE")
        || upper.starts_with("DESC ")
        || upper.starts_with("EXPLAIN")
        || upper.starts_with("EXISTS")
        || upper.starts_with("WITH")
}

fn normalize_value(val: serde_json::Value) -> serde_json::Value {
    match &val {
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            serde_json::Value::String(val.to_string())
        }
        _ => val,
    }
}

fn escape_clickhouse_string_literal(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str(r"\\"),
            '\'' => out.push_str(r"\'"),
            _ => out.push(ch),
        }
    }
    out
}

pub struct ClickHouseDriver;

pub struct ClickHousePool {
    pub conn: ClickHouseConnection,
}

#[async_trait]
impl Driver for ClickHouseDriver {
    fn db_type(&self) -> &'static str {
        "clickhouse"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let conn = ClickHouseConnection::new(params)?;
        let start = Instant::now();
        conn.ping().await?;
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
        let conn = ClickHouseConnection::new(params)?;
        conn.ping().await?;
        Ok(Arc::new(ClickHousePool { conn }))
    }
}

#[async_trait]
impl Pool for ClickHousePool {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::ClickHouse)
    }

    fn supports_explain(&self) -> bool {
        true
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let (_, rows, _, _) = self.conn.query("SELECT version()", None, None).await?;
        let ver = rows
            .first()
            .and_then(|row| row.first())
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        Ok(format!("ClickHouse {ver}"))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        list_databases_clickhouse(&self.conn).await
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_clickhouse(&self.conn, database).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        execute_clickhouse(&self.conn, command, max_rows, schema).await
    }

    async fn explain(
        &self,
        sql: &str,
        _analyze: bool,
        schema: Option<&str>,
    ) -> Result<ExplainResult, DbError> {
        explain_clickhouse(&self.conn, sql, schema).await
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

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

pub async fn list_databases_clickhouse(
    conn: &ClickHouseConnection,
) -> Result<Vec<String>, DbError> {
    let (_, rows, _, _) = conn
        .query(
            "SELECT name FROM system.databases \
             WHERE name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA') \
             ORDER BY name",
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            row.into_iter().next().and_then(|v| match v {
                serde_json::Value::String(s) => Some(s),
                _ => None,
            })
        })
        .collect())
}

pub async fn fetch_schema_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<SchemaInfo, DbError> {
    let tables = fetch_tables_clickhouse(conn, database_name).await?;
    let views = fetch_views_clickhouse(conn, database_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: database_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let db_lit = escape_clickhouse_string_literal(database_name);
    let (_, table_rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, total_rows FROM system.tables \
                 WHERE database = '{db_lit}' \
                 AND engine NOT IN ('View', 'MaterializedView') \
                 ORDER BY name"
            ),
            None,
            None,
        )
        .await?;

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name = table_row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let row_estimate = table_row.get(1).and_then(|v| v.as_u64());

        let columns = fetch_columns_clickhouse(conn, database_name, table_name).await?;
        let indexes = fetch_indexes_clickhouse(conn, database_name, table_name).await?;

        tables.push(TableItem {
            name: table_name.to_string(),
            columns,
            indexes,
            foreign_keys: vec![],
            row_estimate,
        });
    }

    Ok(tables)
}

async fn fetch_views_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let db_lit = escape_clickhouse_string_literal(database_name);
    let (_, view_rows, _, _) = conn
        .query(
            &format!(
                "SELECT name FROM system.tables \
                 WHERE database = '{db_lit}' \
                 AND engine IN ('View', 'MaterializedView') \
                 ORDER BY name"
            ),
            None,
            None,
        )
        .await?;

    let mut views = Vec::with_capacity(view_rows.len());

    for view_row in &view_rows {
        let view_name = view_row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        let columns = fetch_columns_clickhouse(conn, database_name, view_name).await?;

        views.push(ViewItem {
            name: view_name.to_string(),
            columns,
        });
    }

    Ok(views)
}

async fn fetch_columns_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let db_lit = escape_clickhouse_string_literal(database_name);
    let table_lit = escape_clickhouse_string_literal(table_name);
    let (_, rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, type, default_kind, default_expression, is_in_primary_key \
                 FROM system.columns \
                 WHERE database = '{db_lit}' AND table = '{table_lit}' \
                 ORDER BY position"
            ),
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let name = row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let data_type = row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let default_kind = row.get(2).and_then(|v| v.as_str()).unwrap_or_default();
            let default_expr = row.get(3).and_then(|v| v.as_str()).unwrap_or_default();
            let is_pk = row.get(4).and_then(|v| v.as_u64()).unwrap_or(0) == 1;

            let is_nullable = data_type.starts_with("Nullable(");
            let default_value = if default_kind.is_empty() {
                None
            } else {
                Some(default_expr.to_string())
            };

            ColumnDetail {
                name,
                data_type,
                is_nullable,
                is_primary_key: is_pk,
                default_value,
            }
        })
        .collect())
}

async fn fetch_indexes_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let db_lit = escape_clickhouse_string_literal(database_name);
    let table_lit = escape_clickhouse_string_literal(table_name);
    let (_, rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, expr, type \
                 FROM system.data_skipping_indices \
                 WHERE database = '{db_lit}' AND table = '{table_lit}'"
            ),
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let name = row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let expr = row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();

            IndexItem {
                name,
                columns: vec![expr],
                is_unique: false,
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_scheme_default() {
        let params = ConnectionParams {
            db_type: "clickhouse".to_string(),
            host: "localhost".to_string(),
            port: 8123,
            database: "default".to_string(),
            username: "default".to_string(),
            password: String::new(),
            auth_source: None,
            trust_server_certificate: None,
        };
        let conn = ClickHouseConnection::new(&params).unwrap();
        assert_eq!(conn.base_url, "http://localhost:8123");
    }

    #[test]
    fn test_https_scheme_for_8443() {
        let params = ConnectionParams {
            db_type: "clickhouse".to_string(),
            host: "ch.example.com".to_string(),
            port: 8443,
            database: "analytics".to_string(),
            username: "admin".to_string(),
            password: "secret".to_string(),
            auth_source: None,
            trust_server_certificate: None,
        };
        let conn = ClickHouseConnection::new(&params).unwrap();
        assert_eq!(conn.base_url, "https://ch.example.com:8443");
    }

    #[test]
    fn test_normalize_value_primitives() {
        assert_eq!(
            normalize_value(serde_json::Value::String("hello".into())),
            serde_json::Value::String("hello".into())
        );
        assert_eq!(
            normalize_value(serde_json::json!(42)),
            serde_json::json!(42)
        );
        assert_eq!(
            normalize_value(serde_json::Value::Null),
            serde_json::Value::Null
        );
    }

    #[test]
    fn test_normalize_value_complex_types() {
        let arr = serde_json::json!([1, 2, 3]);
        let result = normalize_value(arr);
        assert_eq!(result, serde_json::Value::String("[1,2,3]".into()));

        let obj = serde_json::json!({"key": "val"});
        let result = normalize_value(obj);
        assert_eq!(
            result,
            serde_json::Value::String("{\"key\":\"val\"}".into())
        );
    }

    #[test]
    fn test_is_data_query() {
        assert!(is_data_query("SELECT * FROM t"));
        assert!(is_data_query("  select 1"));
        assert!(is_data_query("SHOW DATABASES"));
        assert!(is_data_query("DESCRIBE TABLE t"));
        assert!(is_data_query("DESC t"));
        assert!(is_data_query("EXPLAIN SELECT 1"));
        assert!(is_data_query("EXISTS TABLE t"));
        assert!(is_data_query("WITH cte AS (SELECT 1) SELECT * FROM cte"));

        assert!(!is_data_query(
            "CREATE TABLE t (id UInt32) ENGINE = MergeTree() ORDER BY id"
        ));
        assert!(!is_data_query("DROP TABLE t"));
        assert!(!is_data_query("ALTER TABLE t ADD COLUMN c String"));
        assert!(!is_data_query("INSERT INTO t VALUES (1)"));
        assert!(!is_data_query("TRUNCATE TABLE t"));
    }

    #[test]
    fn escape_passes_plain_names_unchanged() {
        assert_eq!(escape_clickhouse_string_literal("default"), "default");
        assert_eq!(escape_clickhouse_string_literal("my_db"), "my_db");
    }

    #[test]
    fn escape_quotes_and_backslashes() {
        assert_eq!(escape_clickhouse_string_literal("o'reilly"), r"o\'reilly");
        assert_eq!(escape_clickhouse_string_literal(r"a\b"), r"a\\b");
        assert_eq!(
            escape_clickhouse_string_literal(r"db'; DROP TABLE x; --"),
            r"db\'; DROP TABLE x; --"
        );
    }

    #[test]
    fn escape_handles_mixed_special_chars() {
        assert_eq!(escape_clickhouse_string_literal(r"a\'b"), r"a\\\'b");
    }
}
