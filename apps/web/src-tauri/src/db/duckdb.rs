use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use tokio::sync::Mutex;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

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

#[async_trait]
impl DatabaseDriver for DuckDbDriver {
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
}

impl From<duckdb::Error> for DbError {
    fn from(err: duckdb::Error) -> Self {
        DbError {
            code: "DUCKDB_ERROR".to_string(),
            message: err.to_string(),
        }
    }
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
}
