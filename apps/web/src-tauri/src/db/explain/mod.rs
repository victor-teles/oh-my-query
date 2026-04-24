mod clickhouse;
mod duckdb;
mod mysql;
pub mod parser;
mod postgres;

use serde::{Deserialize, Serialize};

use crate::db::error::DbError;
use crate::db::pool::DatabasePool;

pub use parser::PlanNode;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainParams {
    pub connection_id: String,
    pub sql: String,
    #[serde(default)]
    pub analyze: bool,
    pub schema: Option<String>,
    pub source_dialect: Option<String>,
    pub query_id: Option<String>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    pub engine: &'static str,
    pub root: PlanNode,
    pub raw: String,
    pub analyze_ran: bool,
    pub supports_analyze: bool,
    pub execution_time_ms: u64,
}

pub async fn explain_for_pool(
    pool: &DatabasePool,
    sql: &str,
    analyze: bool,
    schema: Option<&str>,
) -> Result<ExplainResult, DbError> {
    match pool {
        DatabasePool::Postgres(p) => postgres::explain_postgres(p, sql, analyze, schema).await,
        DatabasePool::MySql(p) => mysql::explain_mysql(p, sql, analyze, schema).await,
        DatabasePool::ClickHouse(c) => clickhouse::explain_clickhouse(c, sql, schema).await,
        DatabasePool::DuckDB(h) => duckdb::explain_duckdb(h, sql, analyze).await,
        DatabasePool::Sqlite(_)
        | DatabasePool::MongoDB(_)
        | DatabasePool::Redis(_)
        | DatabasePool::Mssql(_) => Err(DbError {
            code: "EXPLAIN_UNSUPPORTED".to_string(),
            message: "EXPLAIN is not supported for this database type".to_string(),
        }),
    }
}
