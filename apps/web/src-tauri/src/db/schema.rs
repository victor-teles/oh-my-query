use sqlx::Row;

use crate::db::clickhouse::ClickHouseConnection;
use crate::db::error::DbError;
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
        DatabasePool::Redis(_) => Ok(vec!["db0".to_string()]),
        DatabasePool::ClickHouse(conn) => list_databases_clickhouse(conn).await,
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
                name: "db0".to_string(),
                tables: vec![],
                views: vec![],
            }],
        }),
        DatabasePool::ClickHouse(conn) => fetch_schema_clickhouse(conn, database_name).await,
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

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name: String = table_row.try_get("table_name").unwrap_or_default();

        let columns = fetch_columns_postgres(pool, schema_name, &table_name).await?;
        let indexes = fetch_indexes_postgres(pool, schema_name, &table_name).await?;
        let foreign_keys = fetch_fks_postgres(pool, schema_name, &table_name).await?;

        tables.push(TableItem {
            name: table_name,
            columns,
            indexes,
            foreign_keys,
        });
    }

    Ok(tables)
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

async fn fetch_schema_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
) -> Result<SchemaInfo, DbError> {
    let tables = fetch_tables_mysql(pool, schema_name).await?;
    let views = fetch_views_mysql(pool, schema_name).await?;

    Ok(SchemaInfo {
        schemas: vec![SchemaItem {
            name: schema_name.to_string(),
            tables,
            views,
        }],
    })
}

async fn fetch_tables_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
) -> Result<Vec<TableItem>, DbError> {
    let table_rows = sqlx::query(
        "SELECT TABLE_NAME FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' \
         ORDER BY TABLE_NAME",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut tables = Vec::with_capacity(table_rows.len());

    for table_row in &table_rows {
        let table_name: String = table_row.try_get("TABLE_NAME").unwrap_or_default();

        let columns = fetch_columns_mysql(pool, schema_name, &table_name).await?;
        let indexes = fetch_indexes_mysql(pool, schema_name, &table_name).await?;
        let foreign_keys = fetch_fks_mysql(pool, schema_name, &table_name).await?;

        tables.push(TableItem {
            name: table_name,
            columns,
            indexes,
            foreign_keys,
        });
    }

    Ok(tables)
}

async fn fetch_views_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
) -> Result<Vec<ViewItem>, DbError> {
    let view_rows = sqlx::query(
        "SELECT TABLE_NAME FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW' \
         ORDER BY TABLE_NAME",
    )
    .bind(schema_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut views = Vec::with_capacity(view_rows.len());

    for view_row in &view_rows {
        let view_name: String = view_row.try_get("TABLE_NAME").unwrap_or_default();
        let columns = fetch_columns_mysql(pool, schema_name, &view_name).await?;

        views.push(ViewItem {
            name: view_name,
            columns,
        });
    }

    Ok(views)
}

async fn fetch_columns_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ColumnDetail>, DbError> {
    let rows = sqlx::query(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY \
         FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
         ORDER BY ORDINAL_POSITION",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    Ok(rows
        .iter()
        .map(|row| {
            let nullable: String = row.try_get("IS_NULLABLE").unwrap_or_default();
            let column_key: String = row.try_get("COLUMN_KEY").unwrap_or_default();
            ColumnDetail {
                name: row.try_get("COLUMN_NAME").unwrap_or_default(),
                data_type: row.try_get("DATA_TYPE").unwrap_or_default(),
                is_nullable: nullable == "YES",
                is_primary_key: column_key == "PRI",
                default_value: row.try_get("COLUMN_DEFAULT").ok(),
            }
        })
        .collect())
}

async fn fetch_indexes_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<IndexItem>, DbError> {
    let rows = sqlx::query(
        "SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME \
         FROM information_schema.STATISTICS \
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
         ORDER BY INDEX_NAME, SEQ_IN_INDEX",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut index_map: std::collections::HashMap<String, IndexItem> =
        std::collections::HashMap::new();

    for row in &rows {
        let name: String = row.try_get("INDEX_NAME").unwrap_or_default();
        let non_unique: i64 = row.try_get("NON_UNIQUE").unwrap_or(1);
        let column: String = row.try_get("COLUMN_NAME").unwrap_or_default();

        let entry = index_map.entry(name.clone()).or_insert_with(|| IndexItem {
            name,
            columns: Vec::new(),
            is_unique: non_unique == 0,
        });
        entry.columns.push(column);
    }

    Ok(index_map.into_values().collect())
}

async fn fetch_fks_mysql(
    pool: &sqlx::MySqlPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<ForeignKeyItem>, DbError> {
    let rows = sqlx::query(
        "SELECT CONSTRAINT_NAME, COLUMN_NAME, \
                REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME \
         FROM information_schema.KEY_COLUMN_USAGE \
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
             AND REFERENCED_TABLE_NAME IS NOT NULL \
         ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION",
    )
    .bind(schema_name)
    .bind(table_name)
    .fetch_all(pool)
    .await
    .map_err(DbError::from)?;

    let mut fk_map: std::collections::HashMap<String, ForeignKeyItem> =
        std::collections::HashMap::new();

    for row in &rows {
        let name: String = row.try_get("CONSTRAINT_NAME").unwrap_or_default();
        let column: String = row.try_get("COLUMN_NAME").unwrap_or_default();
        let ref_table: String = row.try_get("REFERENCED_TABLE_NAME").unwrap_or_default();
        let ref_column: String = row.try_get("REFERENCED_COLUMN_NAME").unwrap_or_default();

        let entry = fk_map
            .entry(name.clone())
            .or_insert_with(|| ForeignKeyItem {
                name,
                columns: Vec::new(),
                referenced_table: ref_table,
                referenced_columns: Vec::new(),
            });
        entry.columns.push(column);
        entry.referenced_columns.push(ref_column);
    }

    Ok(fk_map.into_values().collect())
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

    let tables: Vec<TableItem> = collection_names
        .into_iter()
        .map(|name| TableItem {
            name,
            columns: vec![],
            indexes: vec![],
            foreign_keys: vec![],
        })
        .collect();

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
        .filter_map(|row| row.into_iter().next().and_then(|v| match v {
            serde_json::Value::String(s) => Some(s),
            _ => None,
        }))
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
                "SELECT name FROM system.tables \
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

        let columns = fetch_columns_clickhouse(conn, database_name, table_name).await?;
        let indexes = fetch_indexes_clickhouse(conn, database_name, table_name).await?;

        tables.push(TableItem {
            name: table_name.to_string(),
            columns,
            indexes,
            foreign_keys: vec![],
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
            let name = row.first().and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let data_type = row.get(1).and_then(|v| v.as_str()).unwrap_or_default().to_string();
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
            let name = row.first().and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let expr = row.get(1).and_then(|v| v.as_str()).unwrap_or_default().to_string();

            IndexItem {
                name,
                columns: vec![expr],
                is_unique: false,
            }
        })
        .collect())
}
