use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use oh_my_query_core::error::DbError;
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, ForeignKeyItem, IndexItem,
    SchemaInfo, SchemaItem, TableItem, TestConnectionResult, ViewItem,
};
use oh_my_query_core::{fetch_rows_native, Driver, Pool};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

pub struct SqliteDriver;

pub fn build_sqlite_url(params: &ConnectionParams) -> String {
    format!("sqlite:{}", params.database)
}

pub struct SqlitePool {
    pub pool: sqlx::SqlitePool,
}

#[async_trait]
impl Driver for SqliteDriver {
    fn db_type(&self) -> &'static str {
        "sqlite"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let url = build_sqlite_url(params);

        let start = Instant::now();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&url)
            .await
            .map_err(DbError::from)?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(DbError::from)?;
        pool.close().await;

        let latency = start.elapsed().as_millis() as u64;
        Ok(TestConnectionResult {
            success: true,
            message: "Connection successful".to_string(),
            latency_ms: latency,
        })
    }

    async fn connect(
        &self,
        _id: &str,
        params: &ConnectionParams,
    ) -> Result<Arc<dyn Pool>, DbError> {
        let url = build_sqlite_url(params);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&url)
            .await
            .map_err(DbError::from)?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(DbError::from)?;

        Ok(Arc::new(SqlitePool { pool }))
    }
}

#[async_trait]
impl Pool for SqlitePool {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::SQLite)
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let row = sqlx::query("SELECT sqlite_version()")
            .fetch_one(&self.pool)
            .await
            .map_err(DbError::from)?;
        let ver: String = row.try_get(0).unwrap_or_default();
        Ok(format!("SQLite {ver}"))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        Ok(vec!["main".to_string()])
    }

    async fn fetch_schema(&self, _database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_sqlite(&self.pool).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        _schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        let (columns, rows, is_truncated) =
            fetch_sql_rows_sqlite(&self.pool, command, max_rows).await?;
        Ok(ExecuteResult::Tabular {
            row_count: rows.len() as u64,
            columns,
            rows,
            execution_time_ms: 0,
            is_truncated,
        })
    }

    async fn close(&self) {
        self.pool.close().await;
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub async fn fetch_sql_rows_sqlite(
    pool: &sqlx::SqlitePool,
    sql: &str,
    max_rows: usize,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    fetch_rows_native!(pool, sql, max_rows)
}

fn is_safe_identifier(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
}

pub async fn fetch_schema_sqlite(pool: &sqlx::SqlitePool) -> Result<SchemaInfo, DbError> {
    let tables = fetch_tables_sqlite(pool).await?;
    let views = fetch_views_sqlite(pool).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: "main".to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_sqlite(pool: &sqlx::SqlitePool) -> Result<Vec<TableItem>, DbError> {
    let table_rows = sqlx::query(
        "SELECT name FROM sqlite_master \
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' \
         ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name: String = table_row.try_get("name").unwrap_or_default();

        if !is_safe_identifier(&table_name) {
            continue;
        }

        let columns = fetch_columns_sqlite(pool, &table_name).await?;
        let indexes = fetch_indexes_sqlite(pool, &table_name).await?;
        let foreign_keys = fetch_fks_sqlite(pool, &table_name).await?;

        tables.push(TableItem {
            name: table_name,
            columns,
            indexes,
            foreign_keys,
            row_estimate: None,
        });
    }

    Ok(tables)
}

async fn fetch_views_sqlite(pool: &sqlx::SqlitePool) -> Result<Vec<ViewItem>, DbError> {
    let view_rows = sqlx::query(
        "SELECT name FROM sqlite_master \
         WHERE type = 'view' \
         ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut views = Vec::with_capacity(view_rows.len());

    for view_row in &view_rows {
        let view_name: String = view_row.try_get("name").unwrap_or_default();

        if !is_safe_identifier(&view_name) {
            continue;
        }

        let columns = fetch_columns_sqlite(pool, &view_name).await?;

        views.push(ViewItem {
            name: view_name,
            columns,
        });
    }

    Ok(views)
}

async fn fetch_columns_sqlite(
    pool: &sqlx::SqlitePool,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let query = format!("PRAGMA table_info('{table_name}')");
    let rows = sqlx::query(&query)
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| {
            let notnull: i32 = row.try_get("notnull").unwrap_or(0);
            let pk: i32 = row.try_get("pk").unwrap_or(0);
            ColumnDetail {
                name: row.try_get("name").unwrap_or_default(),
                data_type: row.try_get("type").unwrap_or_default(),
                is_nullable: notnull == 0,
                is_primary_key: pk > 0,
                default_value: row.try_get("dflt_value").ok(),
            }
        })
        .collect())
}

async fn fetch_indexes_sqlite(
    pool: &sqlx::SqlitePool,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let list_query = format!("PRAGMA index_list('{table_name}')");
    let index_rows = sqlx::query(&list_query)
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;

    let mut indexes = Vec::with_capacity(index_rows.len());

    for index_row in &index_rows {
        let index_name: String = index_row.try_get("name").unwrap_or_default();
        let unique: i32 = index_row.try_get("unique").unwrap_or(0);

        if !is_safe_identifier(&index_name) {
            continue;
        }

        let info_query = format!("PRAGMA index_info('{index_name}')");
        let col_rows = sqlx::query(&info_query)
            .fetch_all(pool)
            .await
            .map_err(DbError::from)?;

        let columns: Vec<String> = col_rows
            .iter()
            .map(|r| r.try_get("name").unwrap_or_default())
            .collect();

        indexes.push(IndexItem {
            name: index_name,
            columns,
            is_unique: unique != 0,
        });
    }

    Ok(indexes)
}

async fn fetch_fks_sqlite(
    pool: &sqlx::SqlitePool,
    table_name: &str,
) -> Result<Vec<ForeignKeyItem>, DbError> {
    let query = format!("PRAGMA foreign_key_list('{table_name}')");
    let rows = sqlx::query(&query)
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;

    let mut fk_map: std::collections::HashMap<i32, ForeignKeyItem> =
        std::collections::HashMap::new();

    for row in &rows {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let from: String = row.try_get("from").unwrap_or_default();
        let table: String = row.try_get("table").unwrap_or_default();
        let to: String = row.try_get("to").unwrap_or_default();

        let entry = fk_map.entry(id).or_insert_with(|| ForeignKeyItem {
            name: format!("fk_{table_name}_{id}"),
            columns: Vec::new(),
            referenced_table: table,
            referenced_columns: Vec::new(),
        });
        entry.columns.push(from);
        entry.referenced_columns.push(to);
    }

    Ok(fk_map.into_values().collect())
}
