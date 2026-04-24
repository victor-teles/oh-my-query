use sqlx::Row;

use crate::db::clickhouse::ClickHouseConnection;
use crate::db::duckdb::DuckDbHandle;
use crate::db::error::DbError;
use crate::db::mssql::MssqlPool;
use crate::db::pool::DatabasePool;
use crate::db::types::{
    ColumnDetail, ForeignKeyItem, IndexItem, SchemaInfo, SchemaItem, TableItem, ViewItem,
};

pub async fn list_databases(pool: &DatabasePool) -> Result<Vec<String>, DbError> {
    match pool {
        DatabasePool::Postgres(pool) => list_databases_postgres(pool).await,
        DatabasePool::MySql(pool) => list_databases_mysql(pool).await,
        DatabasePool::Sqlite(_) => Ok(vec!["main".to_string()]),
        DatabasePool::MongoDB(client) => {
            let names = client.list_database_names().await.map_err(DbError::from)?;
            Ok(names)
        }
        DatabasePool::Redis(_) => Ok((0u8..16).map(|i| format!("db{i}")).collect()),
        DatabasePool::ClickHouse(conn) => list_databases_clickhouse(conn).await,
        DatabasePool::DuckDB(handle) => list_databases_duckdb(handle).await,
        DatabasePool::Mssql(pool) => list_databases_mssql(pool).await,
    }
}

pub async fn fetch_schema(pool: &DatabasePool, database_name: &str) -> Result<SchemaInfo, DbError> {
    match pool {
        DatabasePool::Postgres(pool) => fetch_schema_postgres(pool, database_name).await,
        DatabasePool::MySql(pool) => fetch_schema_mysql(pool, database_name).await,
        DatabasePool::Sqlite(pool) => fetch_schema_sqlite(pool).await,
        DatabasePool::MongoDB(client) => fetch_schema_mongodb(client, database_name).await,
        DatabasePool::Redis(_) => Ok(SchemaInfo {
            schemas: vec![SchemaItem {
                name: database_name.to_string(),
                tables: vec![],
                views: vec![],
            }],
        }),
        DatabasePool::ClickHouse(conn) => fetch_schema_clickhouse(conn, database_name).await,
        DatabasePool::DuckDB(handle) => fetch_schema_duckdb(handle, database_name).await,
        DatabasePool::Mssql(pool) => fetch_schema_mssql(pool, database_name).await,
    }
}

async fn list_databases_postgres(pool: &sqlx::PgPool) -> Result<Vec<String>, DbError> {
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

async fn fetch_schema_postgres(
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

// MySQL introspection

async fn list_databases_mysql(pool: &sqlx::MySqlPool) -> Result<Vec<String>, DbError> {
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

async fn fetch_schema_mysql(
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

// SQLite introspection

fn is_safe_identifier(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
}

async fn fetch_schema_sqlite(pool: &sqlx::SqlitePool) -> Result<SchemaInfo, DbError> {
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

// MongoDB introspection

async fn fetch_schema_mongodb(
    client: &mongodb::Client,
    database_name: &str,
) -> Result<SchemaInfo, DbError> {
    let db = client.database(database_name);
    let collection_names = db.list_collection_names().await.map_err(DbError::from)?;

    let mut tables: Vec<TableItem> = Vec::with_capacity(collection_names.len());
    for name in collection_names {
        let row_estimate = db
            .collection::<mongodb::bson::Document>(&name)
            .estimated_document_count()
            .await
            .ok();

        tables.push(TableItem {
            name,
            columns: vec![],
            indexes: vec![],
            foreign_keys: vec![],
            row_estimate,
        });
    }

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: database_name.to_string(),
            tables,
            views: vec![],
        }],
    })
}

// ClickHouse introspection

async fn list_databases_clickhouse(conn: &ClickHouseConnection) -> Result<Vec<String>, DbError> {
    let (_, rows, _, _) = conn
        .query(
            "SELECT name FROM system.databases \
             WHERE name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA') \
             ORDER BY name",
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            row.into_iter().next().and_then(|v| match v {
                serde_json::Value::String(s) => Some(s),
                _ => None,
            })
        })
        .collect())
}

async fn fetch_schema_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<SchemaInfo, DbError> {
    let tables = fetch_tables_clickhouse(conn, database_name).await?;
    let views = fetch_views_clickhouse(conn, database_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: database_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let (_, table_rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, total_rows FROM system.tables \
                 WHERE database = '{database_name}' \
                 AND engine NOT IN ('View', 'MaterializedView') \
                 ORDER BY name"
            ),
            None,
            None,
        )
        .await?;

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name = table_row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let row_estimate = table_row.get(1).and_then(|v| v.as_u64());

        let columns = fetch_columns_clickhouse(conn, database_name, table_name).await?;
        let indexes = fetch_indexes_clickhouse(conn, database_name, table_name).await?;

        tables.push(TableItem {
            name: table_name.to_string(),
            columns,
            indexes,
            foreign_keys: vec![],
            row_estimate,
        });
    }

    Ok(tables)
}

async fn fetch_views_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let (_, view_rows, _, _) = conn
        .query(
            &format!(
                "SELECT name FROM system.tables \
                 WHERE database = '{database_name}' \
                 AND engine IN ('View', 'MaterializedView') \
                 ORDER BY name"
            ),
            None,
            None,
        )
        .await?;

    let mut views = Vec::with_capacity(view_rows.len());

    for view_row in &view_rows {
        let view_name = view_row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        let columns = fetch_columns_clickhouse(conn, database_name, view_name).await?;

        views.push(ViewItem {
            name: view_name.to_string(),
            columns,
        });
    }

    Ok(views)
}

async fn fetch_columns_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let (_, rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, type, default_kind, default_expression, is_in_primary_key \
                 FROM system.columns \
                 WHERE database = '{database_name}' AND table = '{table_name}' \
                 ORDER BY position"
            ),
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let name = row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let data_type = row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let default_kind = row.get(2).and_then(|v| v.as_str()).unwrap_or_default();
            let default_expr = row.get(3).and_then(|v| v.as_str()).unwrap_or_default();
            let is_pk = row.get(4).and_then(|v| v.as_u64()).unwrap_or(0) == 1;

            let is_nullable = data_type.starts_with("Nullable(");
            let default_value = if default_kind.is_empty() {
                None
            } else {
                Some(default_expr.to_string())
            };

            ColumnDetail {
                name,
                data_type,
                is_nullable,
                is_primary_key: is_pk,
                default_value,
            }
        })
        .collect())
}

async fn fetch_indexes_clickhouse(
    conn: &ClickHouseConnection,
    database_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let (_, rows, _, _) = conn
        .query(
            &format!(
                "SELECT name, expr, type \
                 FROM system.data_skipping_indices \
                 WHERE database = '{database_name}' AND table = '{table_name}'"
            ),
            None,
            None,
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let name = row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let expr = row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();

            IndexItem {
                name,
                columns: vec![expr],
                is_unique: false,
            }
        })
        .collect())
}

// DuckDB introspection

async fn list_databases_duckdb(handle: &DuckDbHandle) -> Result<Vec<String>, DbError> {
    let handle = handle.clone();
    tokio::task::spawn_blocking(move || -> Result<Vec<String>, DbError> {
        let conn = handle.try_lock().map_err(|_| DbError {
            code: "DUCKDB_BUSY".to_string(),
            message: "DuckDB connection is busy".to_string(),
        })?;
        let mut stmt = conn
            .prepare(
                "SELECT schema_name FROM duckdb_schemas() \
                 WHERE NOT internal ORDER BY schema_name",
            )
            .map_err(DbError::from)?;
        let names = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(DbError::from)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        if names.is_empty() {
            Ok(vec!["main".to_string()])
        } else {
            Ok(names)
        }
    })
    .await
    .map_err(|e| DbError {
        code: "DUCKDB_JOIN_ERROR".to_string(),
        message: e.to_string(),
    })?
}

async fn fetch_schema_duckdb(
    handle: &DuckDbHandle,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let handle = handle.clone();
    let schema = schema_name.to_string();
    tokio::task::spawn_blocking(move || -> Result<SchemaInfo, DbError> {
        let conn = handle.try_lock().map_err(|_| DbError {
            code: "DUCKDB_BUSY".to_string(),
            message: "DuckDB connection is busy".to_string(),
        })?;

        let tables = fetch_tables_duckdb(&conn, &schema)?;
        let views = fetch_views_duckdb(&conn, &schema)?;

        Ok(SchemaInfo {
            schemas: vec![SchemaItem {
                name: schema,
                tables,
                views,
            }],
        })
    })
    .await
    .map_err(|e| DbError {
        code: "DUCKDB_JOIN_ERROR".to_string(),
        message: e.to_string(),
    })?
}

fn fetch_tables_duckdb(conn: &duckdb::Connection, schema: &str) -> Result<Vec<TableItem>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name, estimated_size FROM duckdb_tables() \
             WHERE schema_name = ? AND NOT temporary AND NOT internal \
             ORDER BY table_name",
        )
        .map_err(DbError::from)?;

    let rows = stmt
        .query_map([schema], |row| {
            let name: String = row.get(0)?;
            let estimate: Option<i64> = row.get::<_, Option<i64>>(1).ok().flatten();
            Ok((name, estimate))
        })
        .map_err(DbError::from)?;

    let mut tables = Vec::new();
    for row in rows {
        let (name, estimate) = row.map_err(DbError::from)?;
        let columns = fetch_columns_duckdb(conn, schema, &name)?;
        tables.push(TableItem {
            name,
            columns,
            indexes: vec![],
            foreign_keys: vec![],
            row_estimate: estimate.and_then(|v| u64::try_from(v).ok()),
        });
    }
    Ok(tables)
}

fn fetch_views_duckdb(conn: &duckdb::Connection, schema: &str) -> Result<Vec<ViewItem>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT view_name FROM duckdb_views() \
             WHERE schema_name = ? AND NOT internal ORDER BY view_name",
        )
        .map_err(DbError::from)?;

    let names = stmt
        .query_map([schema], |row| row.get::<_, String>(0))
        .map_err(DbError::from)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(DbError::from)?;

    let mut views = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_duckdb(conn, schema, &name)?;
        views.push(ViewItem { name, columns });
    }
    Ok(views)
}

fn fetch_columns_duckdb(
    conn: &duckdb::Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let pk_cols = fetch_primary_key_columns_duckdb(conn, schema, table)?;

    let mut stmt = conn
        .prepare(
            "SELECT column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
        )
        .map_err(DbError::from)?;

    let rows = stmt
        .query_map([schema, table], |row| {
            let name: String = row.get(0)?;
            let data_type: String = row.get(1)?;
            let nullable = row
                .get::<_, String>(2)
                .map(|s| s.eq_ignore_ascii_case("YES"))
                .unwrap_or(true);
            let default_value = row.get::<_, Option<String>>(3).ok().flatten();
            Ok(ColumnDetail {
                is_primary_key: pk_cols.iter().any(|c| c == &name),
                name,
                data_type,
                is_nullable: nullable,
                default_value,
            })
        })
        .map_err(DbError::from)?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(DbError::from)
}

fn fetch_primary_key_columns_duckdb(
    conn: &duckdb::Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<String>, DbError> {
    let Ok(mut stmt) = conn.prepare(
        "SELECT UNNEST(constraint_column_names) FROM duckdb_constraints() \
         WHERE schema_name = ? AND table_name = ? AND constraint_type = 'PRIMARY KEY'",
    ) else {
        return Ok(Vec::new());
    };

    let Ok(rows) = stmt.query_map([schema, table], |row| row.get::<_, String>(0)) else {
        return Ok(Vec::new());
    };

    Ok(rows.flatten().collect())
}

// MSSQL introspection

async fn list_databases_mssql(pool: &MssqlPool) -> Result<Vec<String>, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;
    let results = client
        .simple_query(
            "SELECT name FROM sys.schemas \
             WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner',\
             'db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator',\
             'db_datareader','db_datawriter','db_denydatareader','db_denydatawriter') \
             ORDER BY name",
        )
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();
    if names.is_empty() {
        Ok(vec!["dbo".to_string()])
    } else {
        Ok(names)
    }
}

async fn fetch_schema_mssql(pool: &MssqlPool, schema_name: &str) -> Result<SchemaInfo, DbError> {
    let mut client = pool.get().await.map_err(DbError::from)?;

    let tables = fetch_tables_mssql(&mut client, schema_name).await?;
    let views = fetch_views_mssql(&mut client, schema_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: schema_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let query = format!(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES \
         WHERE TABLE_SCHEMA = '{}' AND TABLE_TYPE = 'BASE TABLE' \
         ORDER BY TABLE_NAME",
        escape_mssql_literal(schema_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();

    let mut tables = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_mssql(client, schema_name, &name).await?;
        let indexes = fetch_indexes_mssql(client, schema_name, &name).await?;
        tables.push(TableItem {
            name,
            columns,
            indexes,
            foreign_keys: vec![],
            row_estimate: None,
        });
    }
    Ok(tables)
}

async fn fetch_views_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let query = format!(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS \
         WHERE TABLE_SCHEMA = '{}' ORDER BY TABLE_NAME",
        escape_mssql_literal(schema_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let names: Vec<String> = results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect();

    let mut views = Vec::with_capacity(names.len());
    for name in names {
        let columns = fetch_columns_mssql(client, schema_name, &name).await?;
        views.push(ViewItem { name, columns });
    }
    Ok(views)
}

async fn fetch_columns_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let query = format!(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT \
         FROM INFORMATION_SCHEMA.COLUMNS \
         WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}' \
         ORDER BY ORDINAL_POSITION",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let pk_cols = fetch_primary_key_columns_mssql(client, schema_name, table_name).await?;

    let columns = results
        .into_iter()
        .flatten()
        .map(|row| {
            let name = row
                .try_get::<&str, _>(0)
                .ok()
                .flatten()
                .unwrap_or("")
                .to_string();
            let data_type = row
                .try_get::<&str, _>(1)
                .ok()
                .flatten()
                .unwrap_or("")
                .to_string();
            let nullable = row
                .try_get::<&str, _>(2)
                .ok()
                .flatten()
                .map(|s| s.eq_ignore_ascii_case("YES"))
                .unwrap_or(true);
            let default_value = row
                .try_get::<&str, _>(3)
                .ok()
                .flatten()
                .map(|s| s.to_string());
            ColumnDetail {
                is_primary_key: pk_cols.iter().any(|c| c == &name),
                name,
                data_type,
                is_nullable: nullable,
                default_value,
            }
        })
        .collect();
    Ok(columns)
}

async fn fetch_primary_key_columns_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<String>, DbError> {
    let query = format!(
        "SELECT kcu.COLUMN_NAME \
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc \
         JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu \
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME \
         AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA \
         WHERE tc.TABLE_SCHEMA = '{}' AND tc.TABLE_NAME = '{}' \
         AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY' \
         ORDER BY kcu.ORDINAL_POSITION",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;
    Ok(results
        .into_iter()
        .flatten()
        .filter_map(|row| {
            row.try_get::<&str, _>(0)
                .ok()
                .flatten()
                .map(|s| s.to_string())
        })
        .collect())
}

async fn fetch_indexes_mssql(
    client: &mut bb8_tiberius::rt::Client,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let query = format!(
        "SELECT i.name, i.is_unique, c.name \
         FROM sys.indexes i \
         JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id \
         JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id \
         JOIN sys.tables t ON t.object_id = i.object_id \
         JOIN sys.schemas s ON s.schema_id = t.schema_id \
         WHERE s.name = '{}' AND t.name = '{}' AND i.is_hypothetical = 0 \
         ORDER BY i.name, ic.key_ordinal",
        escape_mssql_literal(schema_name),
        escape_mssql_literal(table_name)
    );
    let results = client
        .simple_query(query)
        .await
        .map_err(DbError::from)?
        .into_results()
        .await
        .map_err(DbError::from)?;

    let mut map: std::collections::HashMap<String, (bool, Vec<String>)> =
        std::collections::HashMap::new();
    for row in results.into_iter().flatten() {
        let name = row
            .try_get::<&str, _>(0)
            .ok()
            .flatten()
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let is_unique = row.try_get::<bool, _>(1).ok().flatten().unwrap_or(false);
        let col = row
            .try_get::<&str, _>(2)
            .ok()
            .flatten()
            .unwrap_or("")
            .to_string();
        let entry = map.entry(name).or_insert((is_unique, Vec::new()));
        entry.1.push(col);
    }

    Ok(map
        .into_iter()
        .map(|(name, (is_unique, columns))| IndexItem {
            name,
            columns,
            is_unique,
        })
        .collect())
}

fn escape_mssql_literal(input: &str) -> String {
    input.replace('\'', "''")
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
}
