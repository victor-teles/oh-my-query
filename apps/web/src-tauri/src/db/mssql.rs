use std::time::Instant;

use async_trait::async_trait;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::{AuthMethod, Config, EncryptionLevel};

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub type MssqlPool = Pool<ConnectionManager>;

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
    config.trust_cert();
    config
}

pub async fn build_mssql_pool(params: &ConnectionParams) -> Result<MssqlPool, DbError> {
    let config = build_mssql_config(params);
    let manager = ConnectionManager::new(config);
    Pool::builder()
        .max_size(5)
        .connection_timeout(std::time::Duration::from_secs(10))
        .build(manager)
        .await
        .map_err(DbError::from)
}

#[async_trait]
impl DatabaseDriver for MssqlDriver {
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
}

impl From<bb8_tiberius::Error> for DbError {
    fn from(err: bb8_tiberius::Error) -> Self {
        DbError {
            code: "MSSQL_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<bb8::RunError<bb8_tiberius::Error>> for DbError {
    fn from(err: bb8::RunError<bb8_tiberius::Error>) -> Self {
        DbError {
            code: "MSSQL_POOL_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<tiberius::error::Error> for DbError {
    fn from(err: tiberius::error::Error) -> Self {
        DbError {
            code: "MSSQL_ERROR".to_string(),
            message: err.to_string(),
        }
    }
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
}
