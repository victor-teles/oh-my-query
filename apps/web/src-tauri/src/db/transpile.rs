use polyglot_sql::generator::GeneratorConfig;
use polyglot_sql::{parse, transpile, DialectType, Generator};

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

pub fn format_sql(sql: &str, dialect: &str) -> Result<String, DbError> {
    let parsed_dialect: DialectType = dialect.parse().map_err(|e| DbError {
        code: "UNSUPPORTED_DIALECT".to_string(),
        message: format!("Unsupported dialect '{dialect}': {e}"),
    })?;

    let sql = sql.to_string();
    let result = std::thread::Builder::new()
        .stack_size(TRANSPILE_STACK_SIZE)
        .spawn(move || -> polyglot_sql::Result<Vec<String>> {
            let expressions = parse(&sql, parsed_dialect)?;
            let config = GeneratorConfig {
                pretty: true,
                dialect: Some(parsed_dialect),
                ..GeneratorConfig::default()
            };
            expressions
                .iter()
                .map(|expr| {
                    let mut gen = Generator::with_config(config.clone());
                    gen.generate(expr)
                })
                .collect()
        })
        .map_err(|e| DbError {
            code: "FORMAT_ERROR".to_string(),
            message: format!("Failed to spawn format thread: {e}"),
        })?
        .join()
        .map_err(|_| DbError {
            code: "FORMAT_ERROR".to_string(),
            message: "SQL formatting crashed unexpectedly".to_string(),
        })?
        .map_err(|e| DbError {
            code: "FORMAT_ERROR".to_string(),
            message: format!("SQL formatting failed: {e}"),
        })?;

    Ok(result.join(";\n\n"))
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

    #[test]
    fn test_format_sql_basic() {
        let result = format_sql(
            "select id, name from users where active = true",
            "postgresql",
        )
        .unwrap();
        assert!(result.contains("SELECT"));
        assert!(result.contains('\n'));
    }

    #[test]
    fn test_format_sql_unsupported_dialect() {
        let result = format_sql("SELECT 1", "not_a_dialect");
        assert!(result.is_err());
    }

    #[test]
    fn test_format_sql_multi_statement() {
        let result = format_sql("select 1; select 2", "postgresql").unwrap();
        assert!(result.contains(";\n\n"));
    }
}
