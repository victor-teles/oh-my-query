use async_trait::async_trait;
use sqlx::mysql::MySqlPoolOptions;
use std::time::Instant;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub struct MysqlDriver;

#[async_trait]
impl DatabaseDriver for MysqlDriver {
    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let url = format!(
            "mysql://{}:{}@{}:{}/{}",
            urlencoding::encode(&params.username),
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            urlencoding::encode(&params.database),
        );

        let start = Instant::now();
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&url)
            .await
            .map_err(DbError::from)?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(DbError::from)?;
        pool.close().await;

        let latency = start.elapsed().as_millis() as u64;
        Ok(TestConnectionResult {
            success: true,
            message: "Connection successful".to_string(),
            latency_ms: latency,
        })
    }
}
