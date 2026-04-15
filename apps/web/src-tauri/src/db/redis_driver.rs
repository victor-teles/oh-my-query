use std::time::Instant;

use async_trait::async_trait;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub struct RedisDriver;

pub fn parse_redis_db_index(raw: &str) -> u8 {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return 0;
    }
    let rest = trimmed.strip_prefix("db").unwrap_or(trimmed);
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u8>().unwrap_or(0).min(15)
}

pub fn build_redis_url(params: &ConnectionParams) -> String {
    let db_index = parse_redis_db_index(&params.database);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_plain_digits() {
        assert_eq!(parse_redis_db_index("3"), 3);
    }

    #[test]
    fn parse_db_prefixed() {
        assert_eq!(parse_redis_db_index("db5"), 5);
    }

    #[test]
    fn parse_suffixed_label() {
        assert_eq!(parse_redis_db_index("db10 (42 keys)"), 10);
    }

    #[test]
    fn parse_empty_defaults_to_zero() {
        assert_eq!(parse_redis_db_index(""), 0);
    }

    #[test]
    fn parse_clamps_to_15() {
        assert_eq!(parse_redis_db_index("99"), 15);
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
