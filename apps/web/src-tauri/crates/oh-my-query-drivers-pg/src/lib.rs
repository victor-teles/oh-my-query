use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use oh_my_query_core::error::DbError;
use oh_my_query_core::explain::{parser::parse_postgres, ExplainResult};
use oh_my_query_core::sqlx_helpers::validate_schema_name;
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, ForeignKeyItem, IndexItem,
    SchemaInfo, SchemaItem, TableItem, TestConnectionResult, ViewItem,
};
use oh_my_query_core::{fetch_rows_native, Driver, Pool};
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;

pub struct PostgresDriver;

pub fn build_postgres_url(params: &ConnectionParams) -> String {
    format!(
        "postgres://{}:{}@{}:{}/{}",
        urlencoding::encode(&params.username),
        urlencoding::encode(&params.password),
        params.host,
        params.port,
        urlencoding::encode(&params.database),
    )
}

pub struct PostgresPool {
    pub pool: sqlx::PgPool,
}

#[async_trait]
impl Driver for PostgresDriver {
    fn db_type(&self) -> &'static str {
        "postgresql"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let url = build_postgres_url(params);

        let start = Instant::now();
        let pool = PgPoolOptions::new()
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
        let url = build_postgres_url(params);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&url)
            .await
            .map_err(DbError::from)?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(DbError::from)?;

        Ok(Arc::new(PostgresPool { pool }))
    }
}

#[async_trait]
impl Pool for PostgresPool {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::PostgreSQL)
    }

    fn supports_explain(&self) -> bool {
        true
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let row = sqlx::query("SELECT version()")
            .fetch_one(&self.pool)
            .await
            .map_err(DbError::from)?;
        let full: String = row.try_get(0).unwrap_or_default();
        Ok(full
            .split_whitespace()
            .take(2)
            .collect::<Vec<_>>()
            .join(" "))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        list_databases_postgres(&self.pool).await
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_postgres(&self.pool, database).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        let (columns, rows, is_truncated) =
            fetch_sql_rows_postgres(&self.pool, command, max_rows, schema).await?;
        Ok(ExecuteResult::Tabular {
            row_count: rows.len() as u64,
            columns,
            rows,
            execution_time_ms: 0,
            is_truncated,
        })
    }

    async fn explain(
        &self,
        sql: &str,
        analyze: bool,
        schema: Option<&str>,
    ) -> Result<ExplainResult, DbError> {
        explain_postgres(&self.pool, sql, analyze, schema).await
    }

    async fn close(&self) {
        self.pool.close().await;
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub async fn fetch_sql_rows_postgres(
    pool: &sqlx::PgPool,
    sql: &str,
    max_rows: usize,
    schema: Option<&str>,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    let mut conn = pool.acquire().await.map_err(DbError::from)?;
    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("SET search_path TO \"{}\"", schema_name))
            .execute(&mut *conn)
            .await
            .map_err(DbError::from)?;
    }
    let result = run_native_fetch(&mut conn, sql, max_rows).await;
    if schema.is_some() {
        let _ = sqlx::query("RESET search_path").execute(&mut *conn).await;
    }
    result
}

async fn run_native_fetch(
    conn: &mut sqlx::PgConnection,
    sql: &str,
    max_rows: usize,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    fetch_rows_native!(&mut *conn, sql, max_rows)
}

pub async fn explain_postgres(
    pool: &sqlx::PgPool,
    sql: &str,
    analyze: bool,
    schema: Option<&str>,
) -> Result<ExplainResult, DbError> {
    let trimmed = sql.trim().trim_end_matches(';').trim();
    if trimmed.is_empty() {
        return Err(DbError {
            code: "EXPLAIN_EMPTY".to_string(),
            message: "Cannot EXPLAIN empty SQL".to_string(),
        });
    }

    if analyze {
        guard_destructive(trimmed)?;
    }

    let options = if analyze {
        "ANALYZE, BUFFERS, VERBOSE, FORMAT JSON"
    } else {
        "VERBOSE, FORMAT JSON"
    };
    let wrapped = format!("EXPLAIN ({options}) {trimmed}");

    let mut tx = pool.begin().await.map_err(DbError::from)?;

    if analyze {
        sqlx::query("SET TRANSACTION READ ONLY")
            .execute(&mut *tx)
            .await
            .map_err(DbError::from)?;
    }

    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("SET LOCAL search_path TO \"{schema_name}\""))
            .execute(&mut *tx)
            .await
            .map_err(DbError::from)?;
    }

    let start = Instant::now();
    let parsed = fetch_explain_json(&mut tx, &wrapped, analyze).await?;
    let _ = tx.rollback().await;

    let raw = serde_json::to_string_pretty(&parsed).unwrap_or_default();
    let root = parse_postgres(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "postgresql",
        root,
        raw,
        analyze_ran: analyze,
        supports_analyze: true,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}

async fn fetch_explain_json(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    wrapped: &str,
    analyze: bool,
) -> Result<serde_json::Value, DbError> {
    use futures::TryStreamExt;

    let mut stream = sqlx::raw_sql(wrapped).fetch(&mut **tx);
    let row = stream
        .try_next()
        .await
        .map_err(|e| map_read_only_violation(e, analyze))?
        .ok_or_else(|| DbError {
            code: "EXPLAIN_PARSE_ERROR".to_string(),
            message: "PostgreSQL EXPLAIN returned no rows".to_string(),
        })?;

    let parsed: serde_json::Value = row
        .try_get::<sqlx::types::Json<serde_json::Value>, _>(0)
        .map(|j| j.0)
        .or_else(|_| {
            row.try_get::<String, _>(0)
                .map_err(DbError::from)
                .and_then(|s| {
                    serde_json::from_str(&s).map_err(|e| DbError {
                        code: "EXPLAIN_PARSE_ERROR".to_string(),
                        message: format!("Failed to parse PG EXPLAIN JSON: {e}"),
                    })
                })
        })?;
    drop(stream);
    Ok(parsed)
}

fn map_read_only_violation(err: sqlx::Error, analyze: bool) -> DbError {
    if analyze {
        if let sqlx::Error::Database(ref db) = err {
            if db.code().as_deref() == Some("25006") {
                return DbError {
                    code: "EXPLAIN_DESTRUCTIVE".to_string(),
                    message: "Refusing to EXPLAIN ANALYZE a statement that would modify data. Turn off ANALYZE to see the estimated plan.".to_string(),
                };
            }
        }
    }
    DbError::from(err)
}

fn guard_destructive(sql: &str) -> Result<(), DbError> {
    let head = sql
        .split_ascii_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    match head.as_str() {
        "SELECT" | "WITH" | "VALUES" | "TABLE" | "SHOW" => Ok(()),
        _ => Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: format!(
                "Refusing to EXPLAIN ANALYZE on a {head} statement — it would execute. Turn off ANALYZE to see the estimated plan."
            ),
        }),
    }
}

pub async fn list_databases_postgres(pool: &sqlx::PgPool) -> Result<Vec<String>, DbError> {
    let rows = sqlx::query(
        "SELECT schema_name FROM information_schema.schemata \
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') \
         ORDER BY schema_name",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| row.try_get("schema_name").unwrap_or_default())
        .collect())
}

pub async fn fetch_schema_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let tables = fetch_tables_postgres(pool, schema_name).await?;
    let views = fetch_views_postgres(pool, schema_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: schema_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let table_rows = sqlx::query(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = $1 AND table_type = 'BASE TABLE' \
         ORDER BY table_name",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let row_estimates = fetch_row_estimates_postgres(pool, schema_name).await?;

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name: String = table_row.try_get("table_name").unwrap_or_default();

        let columns = fetch_columns_postgres(pool, schema_name, &table_name).await?;
        let indexes = fetch_indexes_postgres(pool, schema_name, &table_name).await?;
        let foreign_keys = fetch_fks_postgres(pool, schema_name, &table_name).await?;
        let row_estimate = row_estimates.get(&table_name).copied();

        tables.push(TableItem {
            name: table_name,
            columns,
            indexes,
            foreign_keys,
            row_estimate,
        });
    }

    Ok(tables)
}

async fn fetch_row_estimates_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
) -> Result<std::collections::HashMap<String, u64>, DbError> {
    let rows = sqlx::query(
        "SELECT c.relname AS table_name, c.reltuples::bigint AS row_estimate \
         FROM pg_class c \
         JOIN pg_namespace n ON n.oid = c.relnamespace \
         WHERE n.nspname = $1 AND c.relkind = 'r'",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut map = std::collections::HashMap::with_capacity(rows.len());
    for row in &rows {
        let name: String = row.try_get("table_name").unwrap_or_default();
        let est: i64 = row.try_get("row_estimate").unwrap_or(0);
        if est >= 0 {
            map.insert(name, est as u64);
        }
    }

    Ok(map)
}

async fn fetch_views_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let view_rows = sqlx::query(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = $1 AND table_type = 'VIEW' \
         ORDER BY table_name",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut views = Vec::with_capacity(view_rows.len());

    for view_row in &view_rows {
        let view_name: String = view_row.try_get("table_name").unwrap_or_default();
        let columns = fetch_columns_postgres(pool, schema_name, &view_name).await?;

        views.push(ViewItem {
            name: view_name,
            columns,
        });
    }

    Ok(views)
}

async fn fetch_columns_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let rows = sqlx::query(
        "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, \
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk \
         FROM information_schema.columns c \
         LEFT JOIN ( \
             SELECT kcu.column_name \
             FROM information_schema.table_constraints tc \
             JOIN information_schema.key_column_usage kcu \
                 ON tc.constraint_name = kcu.constraint_name \
                 AND tc.table_schema = kcu.table_schema \
             WHERE tc.constraint_type = 'PRIMARY KEY' \
                 AND tc.table_schema = $1 AND tc.table_name = $2 \
         ) pk ON c.column_name = pk.column_name \
         WHERE c.table_schema = $1 AND c.table_name = $2 \
         ORDER BY c.ordinal_position",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| {
            let nullable: String = row.try_get("is_nullable").unwrap_or_default();
            ColumnDetail {
                name: row.try_get("column_name").unwrap_or_default(),
                data_type: row.try_get("data_type").unwrap_or_default(),
                is_nullable: nullable == "YES",
                is_primary_key: row.try_get("is_pk").unwrap_or(false),
                default_value: row.try_get("column_default").ok(),
            }
        })
        .collect())
}

async fn fetch_indexes_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let rows = sqlx::query(
        "SELECT i.relname AS index_name, \
                ix.indisunique AS is_unique, \
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns \
         FROM pg_index ix \
         JOIN pg_class t ON t.oid = ix.indrelid \
         JOIN pg_class i ON i.oid = ix.indexrelid \
         JOIN pg_namespace n ON n.oid = t.relnamespace \
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) \
         WHERE n.nspname = $1 AND t.relname = $2 \
         GROUP BY i.relname, ix.indisunique \
         ORDER BY i.relname",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| {
            let columns: Vec<String> = row.try_get("columns").unwrap_or_default();
            IndexItem {
                name: row.try_get("index_name").unwrap_or_default(),
                columns,
                is_unique: row.try_get("is_unique").unwrap_or(false),
            }
        })
        .collect())
}

async fn fetch_fks_postgres(
    pool: &sqlx::PgPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ForeignKeyItem>, DbError> {
    let rows = sqlx::query(
        "SELECT tc.constraint_name, \
                kcu.column_name, \
                ccu.table_name AS referenced_table, \
                ccu.column_name AS referenced_column \
         FROM information_schema.table_constraints tc \
         JOIN information_schema.key_column_usage kcu \
             ON tc.constraint_name = kcu.constraint_name \
             AND tc.table_schema = kcu.table_schema \
         JOIN information_schema.constraint_column_usage ccu \
             ON ccu.constraint_name = tc.constraint_name \
             AND ccu.table_schema = tc.table_schema \
         WHERE tc.constraint_type = 'FOREIGN KEY' \
             AND tc.table_schema = $1 AND tc.table_name = $2 \
         ORDER BY tc.constraint_name, kcu.ordinal_position",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut fk_map: std::collections::HashMap<String, ForeignKeyItem> =
        std::collections::HashMap::new();

    for row in &rows {
        let name: String = row.try_get("constraint_name").unwrap_or_default();
        let column: String = row.try_get("column_name").unwrap_or_default();
        let ref_table: String = row.try_get("referenced_table").unwrap_or_default();
        let ref_column: String = row.try_get("referenced_column").unwrap_or_default();

        let entry = fk_map
            .entry(name.clone())
            .or_insert_with(|| ForeignKeyItem {
                name,
                columns: Vec::new(),
                referenced_table: ref_table,
                referenced_columns: Vec::new(),
            });
        if !entry.columns.contains(&column) {
            entry.columns.push(column);
        }
        if !entry.referenced_columns.contains(&ref_column) {
            entry.referenced_columns.push(ref_column);
        }
    }

    Ok(fk_map.into_values().collect())
}
