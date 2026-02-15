use async_trait::async_trait;
use sqlx::sqlite::SqlitePoolOptions;
use std::time::Instant;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub struct SqliteDriver;

#[async_trait]
impl DatabaseDriver for SqliteDriver {
    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let url = format!("sqlite:{}", params.database);

        let start = Instant::now();
        let pool = SqlitePoolOptions::new()
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
