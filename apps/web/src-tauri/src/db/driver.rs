use std::sync::Arc;

use oh_my_query_core::Driver;
use oh_my_query_drivers_clickhouse::ClickHouseDriver;
use oh_my_query_drivers_duckdb::DuckDbDriver;
use oh_my_query_drivers_mongo::MongoDbDriver;
use oh_my_query_drivers_mssql::MssqlDriver;
use oh_my_query_drivers_mysql::MysqlDriver;
use oh_my_query_drivers_pg::PostgresDriver;
use oh_my_query_drivers_redis::RedisDriver;
use oh_my_query_drivers_sqlite::SqliteDriver;

use crate::db::error::DbError;

pub fn get_driver(db_type: &str) -> Result<Arc<dyn Driver>, DbError> {
    match db_type {
        "postgresql" => Ok(Arc::new(PostgresDriver)),
        "mysql" => Ok(Arc::new(MysqlDriver)),
        "sqlite" => Ok(Arc::new(SqliteDriver)),
        "mongodb" => Ok(Arc::new(MongoDbDriver)),
        "redis" => Ok(Arc::new(RedisDriver)),
        "clickhouse" => Ok(Arc::new(ClickHouseDriver)),
        "duckdb" => Ok(Arc::new(DuckDbDriver)),
        "mssql" => Ok(Arc::new(MssqlDriver)),
        other => Err(DbError {
            code: "UNSUPPORTED_DRIVER".to_string(),
            message: format!("Unsupported database type: {other}"),
        }),
    }
}
