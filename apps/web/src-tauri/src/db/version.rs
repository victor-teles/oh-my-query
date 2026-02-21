use sqlx::Row;

use crate::db::error::DbError;
use crate::db::pool::DatabasePool;

pub async fn fetch_version(pool: &DatabasePool) -> Result<String, DbError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let row = sqlx::query("SELECT version()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let full: String = row.try_get(0).unwrap_or_default();
            Ok(full
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" "))
        }
        DatabasePool::MySql(pool) => {
            let row = sqlx::query("SELECT VERSION()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let ver: String = row.try_get(0).unwrap_or_default();
            Ok(format!("MySQL {ver}"))
        }
        DatabasePool::Sqlite(pool) => {
            let row = sqlx::query("SELECT sqlite_version()")
                .fetch_one(pool)
                .await
                .map_err(DbError::from)?;
            let ver: String = row.try_get(0).unwrap_or_default();
            Ok(format!("SQLite {ver}"))
        }
        DatabasePool::MongoDB(client) => {
            let result = client
                .database("admin")
                .run_command(mongodb::bson::doc! { "buildInfo": 1 })
                .await
                .map_err(DbError::from)?;
            let version = result.get_str("version").unwrap_or("unknown");
            Ok(format!("MongoDB {version}"))
        }
        DatabasePool::Redis(conn) => {
            let info: String = redis::cmd("INFO")
                .arg("server")
                .query_async(&mut conn.clone())
                .await
                .map_err(DbError::from)?;
            let version = info
                .lines()
                .find(|l| l.starts_with("redis_version:"))
                .and_then(|l| l.strip_prefix("redis_version:"))
                .unwrap_or("unknown")
                .trim();
            Ok(format!("Redis {version}"))
        }
        DatabasePool::ClickHouse(conn) => {
            let (_, rows, _, _) = conn.query("SELECT version()", None, None).await?;
            let ver = rows
                .first()
                .and_then(|row| row.first())
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            Ok(format!("ClickHouse {ver}"))
        }
    }
}
