use std::time::Instant;

use async_trait::async_trait;
use serde::Deserialize;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ColumnInfo, ConnectionParams, TestConnectionResult};

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

pub struct ClickHouseDriver;

#[async_trait]
impl DatabaseDriver for ClickHouseDriver {
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
}
