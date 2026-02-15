use std::collections::HashMap;

use tokio::sync::Mutex;

use crate::db::error::DbError;
use crate::db::types::ConnectionParams;

#[derive(Clone)]
pub enum DatabasePool {
    Postgres(sqlx::PgPool),
    MySql(sqlx::MySqlPool),
    Sqlite(sqlx::SqlitePool),
}

impl DatabasePool {
    pub async fn close(&self) {
        match self {
            DatabasePool::Postgres(pool) => pool.close().await,
            DatabasePool::MySql(pool) => pool.close().await,
            DatabasePool::Sqlite(pool) => pool.close().await,
        }
    }
}

pub struct ConnectionPoolManager {
    pools: Mutex<HashMap<String, DatabasePool>>,
}

impl ConnectionPoolManager {
    pub fn new() -> Self {
        Self {
            pools: Mutex::new(HashMap::new()),
        }
    }

    pub async fn connect(&self, id: &str, params: &ConnectionParams) -> Result<(), DbError> {
        let url = build_connection_url(params);
        let pool = connect_native(params.db_type.as_str(), &url).await?;

        verify_connection(&pool).await?;

        let mut pools = self.pools.lock().await;
        if let Some(old_pool) = pools.insert(id.to_string(), pool) {
            old_pool.close().await;
        }

        Ok(())
    }

    pub async fn disconnect(&self, id: &str) -> Result<(), DbError> {
        let mut pools = self.pools.lock().await;
        if let Some(pool) = pools.remove(id) {
            pool.close().await;
        }
        Ok(())
    }

    pub async fn get_pool(&self, id: &str) -> Result<DatabasePool, DbError> {
        let pools = self.pools.lock().await;
        pools.get(id).cloned().ok_or_else(|| DbError {
            code: "NOT_CONNECTED".to_string(),
            message: format!("No active connection for id: {id}"),
        })
    }
}

async fn connect_native(db_type: &str, url: &str) -> Result<DatabasePool, DbError> {
    match db_type {
        "postgresql" => {
            let pool = sqlx::postgres::PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(url)
                .await
                .map_err(DbError::from)?;
            Ok(DatabasePool::Postgres(pool))
        }
        "mysql" => {
            let pool = sqlx::mysql::MySqlPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(url)
                .await
                .map_err(DbError::from)?;
            Ok(DatabasePool::MySql(pool))
        }
        "sqlite" => {
            let pool = sqlx::sqlite::SqlitePoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(url)
                .await
                .map_err(DbError::from)?;
            Ok(DatabasePool::Sqlite(pool))
        }
        other => Err(DbError {
            code: "UNSUPPORTED_DRIVER".to_string(),
            message: format!("Unsupported database type: {other}"),
        }),
    }
}

async fn verify_connection(pool: &DatabasePool) -> Result<(), DbError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            sqlx::query("SELECT 1").execute(pool).await.map_err(DbError::from)?;
        }
        DatabasePool::MySql(pool) => {
            sqlx::query("SELECT 1").execute(pool).await.map_err(DbError::from)?;
        }
        DatabasePool::Sqlite(pool) => {
            sqlx::query("SELECT 1").execute(pool).await.map_err(DbError::from)?;
        }
    }
    Ok(())
}

fn build_connection_url(params: &ConnectionParams) -> String {
    match params.db_type.as_str() {
        "sqlite" => format!("sqlite:{}", params.database),
        "mysql" => format!(
            "mysql://{}:{}@{}:{}/{}",
            urlencoding::encode(&params.username),
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            urlencoding::encode(&params.database),
        ),
        _ => format!(
            "postgres://{}:{}@{}:{}/{}",
            urlencoding::encode(&params.username),
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            urlencoding::encode(&params.database),
        ),
    }
}
