use std::any::Any;
use std::sync::Arc;

use async_trait::async_trait;

use crate::error::DbError;
use crate::explain::ExplainResult;
use crate::transpile::DialectType;
use crate::types::{ConnectionParams, ExecuteResult, SchemaInfo, TestConnectionResult};

#[async_trait]
pub trait Driver: Send + Sync {
    fn db_type(&self) -> &'static str;

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError>;

    async fn connect(&self, id: &str, params: &ConnectionParams) -> Result<Arc<dyn Pool>, DbError>;
}

#[async_trait]
pub trait Pool: Send + Sync + Any {
    fn dialect(&self) -> Option<DialectType> {
        None
    }

    fn supports_explain(&self) -> bool {
        false
    }

    async fn fetch_version(&self) -> Result<String, DbError>;

    async fn list_databases(&self) -> Result<Vec<String>, DbError>;

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError>;

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError>;

    async fn explain(
        &self,
        _sql: &str,
        _analyze: bool,
        _schema: Option<&str>,
    ) -> Result<ExplainResult, DbError> {
        Err(DbError::unsupported(
            "EXPLAIN is not supported for this database type",
        ))
    }

    async fn close(&self) {}

    fn as_any(&self) -> &dyn Any;
}
