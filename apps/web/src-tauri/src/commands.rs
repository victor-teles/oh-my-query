use crate::db::driver::get_driver;
use crate::db::error::DbError;
use crate::db::types::{ConnectionParams, TestConnectionResult};

#[tauri::command]
pub async fn test_connection(params: ConnectionParams) -> Result<TestConnectionResult, DbError> {
    let driver = get_driver(&params.db_type)?;
    driver.test_connection(&params).await
}
