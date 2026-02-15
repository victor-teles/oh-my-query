use std::time::Instant;

use async_trait::async_trait;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub struct RedisDriver;

pub fn build_redis_url(params: &ConnectionParams) -> String {
    let db_index = params.database.parse::<u8>().unwrap_or(0);
    if params.password.is_empty() {
        format!("redis://{}:{}/{}", params.host, params.port, db_index)
    } else {
        format!(
            "redis://:{}@{}:{}/{}",
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            db_index,
        )
    }
}

#[async_trait]
impl DatabaseDriver for RedisDriver {
    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let start = Instant::now();

        let url = build_redis_url(params);
        let client = redis::Client::open(url.as_str()).map_err(DbError::from)?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(DbError::from)?;

        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(DbError::from)?;

        let latency_ms = start.elapsed().as_millis() as u64;

        Ok(TestConnectionResult {
            success: true,
            message: "Connection successful".to_string(),
            latency_ms,
        })
    }

}
