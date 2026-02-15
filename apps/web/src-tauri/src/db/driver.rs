use async_trait::async_trait;

use crate::db::error::DbError;
use crate::db::mongodb_driver::MongoDbDriver;
use crate::db::mysql::MysqlDriver;
use crate::db::postgres::PostgresDriver;
use crate::db::redis_driver::RedisDriver;
use crate::db::sqlite::SqliteDriver;
use crate::db::types::{ConnectionParams, TestConnectionResult};

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError>;

}

pub fn get_driver(db_type: &str) -> Result<Box<dyn DatabaseDriver>, DbError> {
    match db_type {
        "postgresql" => Ok(Box::new(PostgresDriver)),
        "mysql" => Ok(Box::new(MysqlDriver)),
        "sqlite" => Ok(Box::new(SqliteDriver)),
        "mongodb" => Ok(Box::new(MongoDbDriver)),
        "redis" => Ok(Box::new(RedisDriver)),
        other => Err(DbError {
            code: "UNSUPPORTED_DRIVER".to_string(),
            message: format!("Unsupported database type: {other}"),
        }),
    }
}
