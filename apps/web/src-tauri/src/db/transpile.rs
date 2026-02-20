use polyglot_sql::{transpile, DialectType};

use crate::db::error::DbError;
use crate::db::pool::DatabasePool;

pub fn pool_dialect(pool: &DatabasePool) -> DialectType {
    match pool {
        DatabasePool::Postgres(_) => DialectType::PostgreSQL,
        DatabasePool::MySql(_) => DialectType::MySQL,
        DatabasePool::Sqlite(_) => DialectType::SQLite,
        _ => unreachable!("transpile only applies to SQL pools"),
    }
}

const TRANSPILE_STACK_SIZE: usize = 16 * 1024 * 1024;

pub fn transpile_sql(
    sql: &str,
    source_dialect: &str,
    target: DialectType,
) -> Result<String, DbError> {
    let source: DialectType = source_dialect.parse().map_err(|e| DbError {
        code: "UNSUPPORTED_DIALECT".to_string(),
        message: format!("Unsupported source dialect '{source_dialect}': {e}"),
    })?;

    if source == target {
        return Ok(sql.to_string());
    }

    let sql = sql.to_string();
    let result = std::thread::Builder::new()
        .stack_size(TRANSPILE_STACK_SIZE)
        .spawn(move || transpile(&sql, source, target))
        .map_err(|e| DbError {
            code: "TRANSPILE_ERROR".to_string(),
            message: format!("Failed to spawn transpile thread: {e}"),
        })?
        .join()
        .map_err(|_| DbError {
            code: "TRANSPILE_ERROR".to_string(),
            message: "SQL transpilation crashed unexpectedly".to_string(),
        })?
        .map_err(|e| DbError {
            code: "TRANSPILE_ERROR".to_string(),
            message: format!("SQL transpilation failed: {e}"),
        })?;

    Ok(result.join(";\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ifnull_mysql_to_postgres() {
        let result = transpile_sql(
            r#"select IFNULL(avatar_url, name) FROM "users""#,
            "mysql",
            DialectType::PostgreSQL,
        )
        .unwrap();
        assert_eq!(result, r#"SELECT COALESCE(avatar_url, name) FROM "users""#);
    }

    #[test]
    fn test_same_dialect_passthrough() {
        let sql = "SELECT 1";
        let result = transpile_sql(sql, "postgresql", DialectType::PostgreSQL).unwrap();
        assert_eq!(result, sql);
    }

    #[test]
    fn test_unsupported_dialect() {
        let result = transpile_sql("SELECT 1", "invalid", DialectType::PostgreSQL);
        assert!(result.is_err());
    }
}
