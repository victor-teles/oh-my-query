use std::collections::HashMap;
use std::sync::Arc;

use oh_my_query_core::Pool;
use tokio::sync::Mutex;

use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::types::ConnectionParams;

pub struct ConnectionPoolManager {
    pools: Mutex<HashMap<String, Arc<dyn Pool>>>,
}

impl ConnectionPoolManager {
    pub fn new() -> Self {
        Self {
            pools: Mutex::new(HashMap::new()),
        }
    }

    pub async fn connect(&self, id: &str, params: &ConnectionParams) -> Result<(), DbError> {
        let driver = get_driver(&params.db_type)?;
        let pool = driver.connect(id, params).await?;

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

    pub async fn get_pool(&self, id: &str) -> Result<Arc<dyn Pool>, DbError> {
        let pools = self.pools.lock().await;
        pools.get(id).cloned().ok_or_else(|| DbError {
            code: "NOT_CONNECTED".to_string(),
            message: format!("No active connection for id: {id}"),
        })
    }
}

impl Default for ConnectionPoolManager {
    fn default() -> Self {
        Self::new()
    }
}
