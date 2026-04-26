use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use oh_my_query_core::error::DbError;
use oh_my_query_core::explain::{parser::parse_mysql, ExplainResult};
use oh_my_query_core::sqlx_helpers::validate_schema_name;
use oh_my_query_core::transpile::DialectType;
use oh_my_query_core::types::{
    ColumnDetail, ColumnInfo, ConnectionParams, ExecuteResult, ForeignKeyItem, IndexItem,
    SchemaInfo, SchemaItem, TableItem, TestConnectionResult, ViewItem,
};
use oh_my_query_core::{fetch_rows_native, Driver, Pool};
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};
use sqlx::Row;

pub struct MysqlDriver;

pub fn build_mysql_url(params: &ConnectionParams) -> String {
    format!(
        "mysql://{}:{}@{}:{}/{}",
        urlencoding::encode(&params.username),
        urlencoding::encode(&params.password),
        params.host,
        params.port,
        urlencoding::encode(&params.database),
    )
}

pub struct MysqlPool {
    pub pool: sqlx::MySqlPool,
}

#[async_trait]
impl Driver for MysqlDriver {
    fn db_type(&self) -> &'static str {
        "mysql"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let url = build_mysql_url(params);
        let connect_options: MySqlConnectOptions = url
            .parse::<MySqlConnectOptions>()
            .map_err(DbError::from)?
            .statement_cache_capacity(0);

        let start = Instant::now();
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect_with(connect_options)
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
        let url = build_mysql_url(params);
        let connect_options: MySqlConnectOptions = url
            .parse::<MySqlConnectOptions>()
            .map_err(DbError::from)?
            .statement_cache_capacity(0);

        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(Some(std::time::Duration::from_secs(600)))
            .max_lifetime(Some(std::time::Duration::from_secs(1800)))
            .connect_with(connect_options)
            .await
            .map_err(DbError::from)?;

        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(DbError::from)?;

        Ok(Arc::new(MysqlPool { pool }))
    }
}

#[async_trait]
impl Pool for MysqlPool {
    fn dialect(&self) -> Option<DialectType> {
        Some(DialectType::MySQL)
    }

    fn supports_explain(&self) -> bool {
        true
    }

    async fn fetch_version(&self) -> Result<String, DbError> {
        let row = sqlx::query("SELECT VERSION()")
            .fetch_one(&self.pool)
            .await
            .map_err(DbError::from)?;
        let ver: String = row.try_get(0).unwrap_or_default();
        Ok(format!("MySQL {ver}"))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        list_databases_mysql(&self.pool).await
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        fetch_schema_mysql(&self.pool, database).await
    }

    async fn execute(
        &self,
        command: &str,
        max_rows: usize,
        schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        let (columns, rows, is_truncated) =
            fetch_sql_rows_mysql(&self.pool, command, max_rows, schema).await?;
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
        explain_mysql(&self.pool, sql, analyze, schema).await
    }

    async fn close(&self) {
        self.pool.close().await;
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub async fn fetch_sql_rows_mysql(
    pool: &sqlx::MySqlPool,
    sql: &str,
    max_rows: usize,
    schema: Option<&str>,
) -> Result<(Vec<ColumnInfo>, Vec<Vec<serde_json::Value>>, bool), DbError> {
    let mut conn = pool.acquire().await.map_err(DbError::from)?;
    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("USE `{}`", schema_name))
            .execute(&mut *conn)
            .await
            .map_err(DbError::from)?;
    }
    fetch_rows_native!(&mut *conn, sql, max_rows)
}

pub async fn explain_mysql(
    pool: &sqlx::MySqlPool,
    sql: &str,
    analyze: bool,
    schema: Option<&str>,
) -> Result<ExplainResult, DbError> {
    use futures::TryStreamExt;

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

    let wrapped = format!("EXPLAIN FORMAT=JSON {trimmed}");
    let analyze_ran = false;

    let mut conn = pool.acquire().await.map_err(DbError::from)?;
    if let Some(schema_name) = schema {
        validate_schema_name(schema_name)?;
        sqlx::query(&format!("USE `{schema_name}`"))
            .execute(&mut *conn)
            .await
            .map_err(DbError::from)?;
    }

    let start = Instant::now();
    let mut stream = sqlx::raw_sql(&wrapped).fetch(&mut *conn);
    let row = stream
        .try_next()
        .await
        .map_err(DbError::from)?
        .ok_or_else(|| DbError {
            code: "EXPLAIN_PARSE_ERROR".to_string(),
            message: "MySQL EXPLAIN returned no rows".to_string(),
        })?;

    let json_text: String = row.try_get(0).map_err(DbError::from)?;
    drop(stream);
    let parsed: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: format!("Failed to parse MySQL EXPLAIN JSON: {e}"),
    })?;

    let raw = serde_json::to_string_pretty(&parsed).unwrap_or(json_text);
    let root = parse_mysql(&parsed).map_err(|e| DbError {
        code: "EXPLAIN_PARSE_ERROR".to_string(),
        message: e,
    })?;

    Ok(ExplainResult {
        engine: "mysql",
        root,
        raw,
        analyze_ran,
        supports_analyze: false,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}

fn guard_destructive(sql: &str) -> Result<(), DbError> {
    let head = sql
        .split_ascii_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    let head_ok = matches!(head.as_str(), "SELECT" | "WITH" | "VALUES" | "TABLE");
    if !head_ok {
        return Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: format!(
                "Refusing to EXPLAIN ANALYZE on a {head} statement — it would execute."
            ),
        });
    }
    if contains_destructive_keyword(sql) {
        return Err(DbError {
            code: "EXPLAIN_DESTRUCTIVE".to_string(),
            message: "Refusing to EXPLAIN ANALYZE a statement that contains a data-modifying clause (e.g. WITH … AS (DELETE …)). Turn off ANALYZE to see the estimated plan.".to_string(),
        });
    }
    Ok(())
}

fn contains_destructive_keyword(sql: &str) -> bool {
    const DESTRUCTIVE: &[&str] = &[
        "DELETE", "UPDATE", "INSERT", "MERGE", "TRUNCATE", "DROP", "ALTER", "CREATE", "GRANT",
        "REVOKE", "CALL",
    ];
    sql.split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
        .map(str::to_ascii_uppercase)
        .any(|tok| DESTRUCTIVE.contains(&tok.as_str()))
}

pub async fn list_databases_mysql(pool: &sqlx::MySqlPool) -> Result<Vec<String>, DbError> {
    let rows = sqlx::query(
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA \
         WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') \
         ORDER BY SCHEMA_NAME",
    )
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| row.try_get("SCHEMA_NAME").unwrap_or_default())
        .collect())
}

struct MysqlTableRow {
    name: String,
    table_type: String,
    row_estimate: Option<u64>,
}

struct MysqlColumnRow {
    table: String,
    column: ColumnDetail,
}

struct MysqlIndexRow {
    table: String,
    index_name: String,
    is_unique: bool,
    column: String,
}

struct MysqlFkRow {
    table: String,
    constraint_name: String,
    column: String,
    referenced_table: String,
    referenced_column: String,
}

pub async fn fetch_schema_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let table_rows = sqlx::query(
        "SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE', 'VIEW') \
         ORDER BY TABLE_NAME",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let column_rows = sqlx::query(
        "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY \
         FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = ? \
         ORDER BY TABLE_NAME, ORDINAL_POSITION",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let index_rows = sqlx::query(
        "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME \
         FROM information_schema.STATISTICS \
         WHERE TABLE_SCHEMA = ? \
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let fk_rows = sqlx::query(
        "SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, \
                REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME \
         FROM information_schema.KEY_COLUMN_USAGE \
         WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL \
         ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let tables = table_rows
        .iter()
        .map(|row| MysqlTableRow {
            name: row.try_get("TABLE_NAME").unwrap_or_default(),
            table_type: row.try_get("TABLE_TYPE").unwrap_or_default(),
            row_estimate: row
                .try_get::<Option<i64>, _>("TABLE_ROWS")
                .ok()
                .flatten()
                .filter(|v| *v >= 0)
                .map(|v| v as u64),
        })
        .collect();

    let columns = column_rows
        .iter()
        .map(|row| {
            let nullable: String = row.try_get("IS_NULLABLE").unwrap_or_default();
            let column_key: String = row.try_get("COLUMN_KEY").unwrap_or_default();
            MysqlColumnRow {
                table: row.try_get("TABLE_NAME").unwrap_or_default(),
                column: ColumnDetail {
                    name: row.try_get("COLUMN_NAME").unwrap_or_default(),
                    data_type: row.try_get("DATA_TYPE").unwrap_or_default(),
                    is_nullable: nullable == "YES",
                    is_primary_key: column_key == "PRI",
                    default_value: row.try_get("COLUMN_DEFAULT").ok(),
                },
            }
        })
        .collect();

    let indexes = index_rows
        .iter()
        .map(|row| {
            let non_unique: i64 = row.try_get("NON_UNIQUE").unwrap_or(1);
            MysqlIndexRow {
                table: row.try_get("TABLE_NAME").unwrap_or_default(),
                index_name: row.try_get("INDEX_NAME").unwrap_or_default(),
                is_unique: non_unique == 0,
                column: row.try_get("COLUMN_NAME").unwrap_or_default(),
            }
        })
        .collect();

    let fks = fk_rows
        .iter()
        .map(|row| MysqlFkRow {
            table: row.try_get("TABLE_NAME").unwrap_or_default(),
            constraint_name: row.try_get("CONSTRAINT_NAME").unwrap_or_default(),
            column: row.try_get("COLUMN_NAME").unwrap_or_default(),
            referenced_table: row.try_get("REFERENCED_TABLE_NAME").unwrap_or_default(),
            referenced_column: row.try_get("REFERENCED_COLUMN_NAME").unwrap_or_default(),
        })
        .collect();

    Ok(build_mysql_schema(
        schema_name,
        tables,
        columns,
        indexes,
        fks,
    ))
}

fn build_mysql_schema(
    schema_name: &str,
    table_rows: Vec<MysqlTableRow>,
    column_rows: Vec<MysqlColumnRow>,
    index_rows: Vec<MysqlIndexRow>,
    fk_rows: Vec<MysqlFkRow>,
) -> SchemaInfo {
    let mut columns_by_table: std::collections::HashMap<String, Vec<ColumnDetail>> =
        std::collections::HashMap::new();
    for row in column_rows {
        columns_by_table
            .entry(row.table)
            .or_default()
            .push(row.column);
    }

    let mut indexes_by_table: std::collections::HashMap<String, Vec<IndexItem>> =
        std::collections::HashMap::new();
    for row in index_rows {
        let table_indexes = indexes_by_table.entry(row.table).or_default();
        if let Some(existing) = table_indexes.iter_mut().find(|i| i.name == row.index_name) {
            existing.columns.push(row.column);
        } else {
            table_indexes.push(IndexItem {
                name: row.index_name,
                columns: vec![row.column],
                is_unique: row.is_unique,
            });
        }
    }

    let mut fks_by_table: std::collections::HashMap<String, Vec<ForeignKeyItem>> =
        std::collections::HashMap::new();
    for row in fk_rows {
        let table_fks = fks_by_table.entry(row.table).or_default();
        if let Some(existing) = table_fks.iter_mut().find(|f| f.name == row.constraint_name) {
            existing.columns.push(row.column);
            existing.referenced_columns.push(row.referenced_column);
        } else {
            table_fks.push(ForeignKeyItem {
                name: row.constraint_name,
                columns: vec![row.column],
                referenced_table: row.referenced_table,
                referenced_columns: vec![row.referenced_column],
            });
        }
    }

    let mut tables: Vec<TableItem> = Vec::new();
    let mut views: Vec<ViewItem> = Vec::new();

    for row in table_rows {
        let columns = columns_by_table.remove(&row.name).unwrap_or_default();

        if row.table_type == "VIEW" {
            views.push(ViewItem {
                name: row.name,
                columns,
            });
            continue;
        }

        let indexes = indexes_by_table.remove(&row.name).unwrap_or_default();
        let foreign_keys = fks_by_table.remove(&row.name).unwrap_or_default();

        tables.push(TableItem {
            name: row.name,
            columns,
            indexes,
            foreign_keys,
            row_estimate: row.row_estimate,
        });
    }

    SchemaInfo {
        schemas: vec![SchemaItem {
            name: schema_name.to_string(),
            tables,
            views,
        }],
    }
}

#[cfg(test)]
mod mysql_build_tests {
    use super::*;

    fn column(name: &str, data_type: &str, is_pk: bool) -> ColumnDetail {
        ColumnDetail {
            name: name.to_string(),
            data_type: data_type.to_string(),
            is_nullable: false,
            is_primary_key: is_pk,
            default_value: None,
        }
    }

    #[test]
    fn groups_columns_indexes_and_fks_by_table() {
        let tables = vec![
            MysqlTableRow {
                name: "users".to_string(),
                table_type: "BASE TABLE".to_string(),
                row_estimate: Some(42),
            },
            MysqlTableRow {
                name: "orders".to_string(),
                table_type: "BASE TABLE".to_string(),
                row_estimate: None,
            },
            MysqlTableRow {
                name: "active_users".to_string(),
                table_type: "VIEW".to_string(),
                row_estimate: None,
            },
        ];

        let columns = vec![
            MysqlColumnRow {
                table: "users".to_string(),
                column: column("id", "int", true),
            },
            MysqlColumnRow {
                table: "users".to_string(),
                column: column("email", "varchar", false),
            },
            MysqlColumnRow {
                table: "orders".to_string(),
                column: column("id", "int", true),
            },
            MysqlColumnRow {
                table: "orders".to_string(),
                column: column("user_id", "int", false),
            },
            MysqlColumnRow {
                table: "active_users".to_string(),
                column: column("id", "int", false),
            },
        ];

        let indexes = vec![
            MysqlIndexRow {
                table: "users".to_string(),
                index_name: "PRIMARY".to_string(),
                is_unique: true,
                column: "id".to_string(),
            },
            MysqlIndexRow {
                table: "users".to_string(),
                index_name: "users_email_idx".to_string(),
                is_unique: false,
                column: "email".to_string(),
            },
            MysqlIndexRow {
                table: "orders".to_string(),
                index_name: "orders_user_fk_idx".to_string(),
                is_unique: false,
                column: "user_id".to_string(),
            },
        ];

        let fks = vec![MysqlFkRow {
            table: "orders".to_string(),
            constraint_name: "orders_user_fk".to_string(),
            column: "user_id".to_string(),
            referenced_table: "users".to_string(),
            referenced_column: "id".to_string(),
        }];

        let schema = build_mysql_schema("shop", tables, columns, indexes, fks);

        assert_eq!(schema.schemas.len(), 1);
        let s = &schema.schemas[0];
        assert_eq!(s.name, "shop");
        assert_eq!(s.tables.len(), 2);
        assert_eq!(s.views.len(), 1);

        let users = s.tables.iter().find(|t| t.name == "users").unwrap();
        assert_eq!(users.row_estimate, Some(42));
        assert_eq!(users.columns.len(), 2);
        assert_eq!(users.indexes.len(), 2);
        assert!(users.foreign_keys.is_empty());

        let orders = s.tables.iter().find(|t| t.name == "orders").unwrap();
        assert_eq!(orders.row_estimate, None);
        assert_eq!(orders.foreign_keys.len(), 1);
        let fk = &orders.foreign_keys[0];
        assert_eq!(fk.columns, vec!["user_id"]);
        assert_eq!(fk.referenced_table, "users");
        assert_eq!(fk.referenced_columns, vec!["id"]);

        let view = &s.views[0];
        assert_eq!(view.name, "active_users");
        assert_eq!(view.columns.len(), 1);
    }

    #[test]
    fn composite_index_and_fk_columns_are_grouped_in_order() {
        let tables = vec![MysqlTableRow {
            name: "memberships".to_string(),
            table_type: "BASE TABLE".to_string(),
            row_estimate: Some(0),
        }];

        let columns = vec![
            MysqlColumnRow {
                table: "memberships".to_string(),
                column: column("user_id", "int", true),
            },
            MysqlColumnRow {
                table: "memberships".to_string(),
                column: column("team_id", "int", true),
            },
        ];

        let indexes = vec![
            MysqlIndexRow {
                table: "memberships".to_string(),
                index_name: "PRIMARY".to_string(),
                is_unique: true,
                column: "user_id".to_string(),
            },
            MysqlIndexRow {
                table: "memberships".to_string(),
                index_name: "PRIMARY".to_string(),
                is_unique: true,
                column: "team_id".to_string(),
            },
        ];

        let fks = vec![
            MysqlFkRow {
                table: "memberships".to_string(),
                constraint_name: "memberships_user_team_fk".to_string(),
                column: "user_id".to_string(),
                referenced_table: "user_teams".to_string(),
                referenced_column: "user_id".to_string(),
            },
            MysqlFkRow {
                table: "memberships".to_string(),
                constraint_name: "memberships_user_team_fk".to_string(),
                column: "team_id".to_string(),
                referenced_table: "user_teams".to_string(),
                referenced_column: "team_id".to_string(),
            },
        ];

        let schema = build_mysql_schema("saas", tables, columns, indexes, fks);

        let t = &schema.schemas[0].tables[0];
        assert_eq!(t.indexes.len(), 1);
        assert_eq!(t.indexes[0].name, "PRIMARY");
        assert_eq!(t.indexes[0].columns, vec!["user_id", "team_id"]);
        assert!(t.indexes[0].is_unique);

        assert_eq!(t.foreign_keys.len(), 1);
        assert_eq!(t.foreign_keys[0].columns, vec!["user_id", "team_id"]);
        assert_eq!(
            t.foreign_keys[0].referenced_columns,
            vec!["user_id", "team_id"]
        );
    }

    #[test]
    fn table_without_columns_or_indexes_is_preserved() {
        let tables = vec![MysqlTableRow {
            name: "empty".to_string(),
            table_type: "BASE TABLE".to_string(),
            row_estimate: None,
        }];
        let schema = build_mysql_schema("db", tables, vec![], vec![], vec![]);
        let t = &schema.schemas[0].tables[0];
        assert_eq!(t.name, "empty");
        assert!(t.columns.is_empty());
        assert!(t.indexes.is_empty());
        assert!(t.foreign_keys.is_empty());
    }

    #[test]
    fn guard_destructive_allows_plain_select() {
        assert!(guard_destructive("SELECT 1").is_ok());
        assert!(guard_destructive("WITH cte AS (SELECT 1) SELECT * FROM cte").is_ok());
    }

    #[test]
    fn guard_destructive_rejects_with_delete_cte() {
        let err = guard_destructive(
            "WITH d AS (DELETE FROM users WHERE id = 1 RETURNING *) SELECT * FROM d",
        )
        .expect_err("expected destructive guard");
        assert_eq!(err.code, "EXPLAIN_DESTRUCTIVE");
    }

    #[test]
    fn guard_destructive_rejects_top_level_dml() {
        for sql in [
            "DELETE FROM t",
            "UPDATE t SET x = 1",
            "INSERT INTO t VALUES (1)",
            "DROP TABLE t",
        ] {
            assert!(
                guard_destructive(sql).is_err(),
                "expected guard to reject `{sql}`"
            );
        }
    }
}
