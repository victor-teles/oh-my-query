use std::time::Instant;

use async_trait::async_trait;

use crate::db::driver::DatabaseDriver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

pub struct MongoDbDriver;

pub fn build_mongodb_uri(params: &ConnectionParams) -> String {
    let has_auth = !params.username.is_empty();
    if has_auth {
        let auth_source = params
            .auth_source
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or("admin");
        format!(
            "mongodb://{}:{}@{}:{}/{}?authSource={}",
            urlencoding::encode(&params.username),
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            urlencoding::encode(&params.database),
            auth_source,
        )
    } else {
        format!(
            "mongodb://{}:{}/{}",
            params.host, params.port, params.database
        )
    }
}

#[async_trait]
impl DatabaseDriver for MongoDbDriver {
    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let start = Instant::now();

        let uri = build_mongodb_uri(params);
        let mut client_options = mongodb::options::ClientOptions::parse(uri)
            .await
            .map_err(DbError::from)?;
        client_options.connect_timeout = Some(std::time::Duration::from_secs(10));
        client_options.server_selection_timeout = Some(std::time::Duration::from_secs(10));

        let client = mongodb::Client::with_options(client_options).map_err(DbError::from)?;

        client
            .database("admin")
            .run_command(mongodb::bson::doc! { "ping": 1 })
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
