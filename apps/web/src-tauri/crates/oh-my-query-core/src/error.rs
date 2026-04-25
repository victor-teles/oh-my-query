use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DbError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl DbError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        DbError {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn cancelled() -> Self {
        DbError::new("QUERY_CANCELLED", "Query cancelled")
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        DbError::new("UNSUPPORTED", message)
    }
}

impl From<tokio::time::error::Elapsed> for DbError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        DbError::new("QUERY_TIMEOUT", "Query exceeded the configured timeout")
    }
}

#[cfg(feature = "sqlx-errors")]
impl From<sqlx::Error> for DbError {
    fn from(err: sqlx::Error) -> Self {
        let (code, message) = match &err {
            sqlx::Error::Configuration(e) => ("CONFIG_ERROR".to_string(), e.to_string()),
            sqlx::Error::Database(e) => (
                e.code()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| "DB_ERROR".to_string()),
                e.message().to_string(),
            ),
            sqlx::Error::Io(e) => ("IO_ERROR".to_string(), e.to_string()),
            sqlx::Error::Tls(e) => ("TLS_ERROR".to_string(), e.to_string()),
            _ => ("UNKNOWN_ERROR".to_string(), err.to_string()),
        };
        DbError { code, message }
    }
}

#[cfg(feature = "mongo-errors")]
impl From<mongodb::error::Error> for DbError {
    fn from(err: mongodb::error::Error) -> Self {
        DbError::new("MONGO_ERROR", err.to_string())
    }
}

#[cfg(feature = "redis-errors")]
impl From<redis::RedisError> for DbError {
    fn from(err: redis::RedisError) -> Self {
        DbError::new("REDIS_ERROR", err.to_string())
    }
}

#[cfg(feature = "reqwest-errors")]
impl From<reqwest::Error> for DbError {
    fn from(err: reqwest::Error) -> Self {
        DbError::new("CLICKHOUSE_ERROR", err.to_string())
    }
}

#[cfg(feature = "duckdb-errors")]
impl From<duckdb::Error> for DbError {
    fn from(err: duckdb::Error) -> Self {
        DbError::new("DUCKDB_ERROR", err.to_string())
    }
}

#[cfg(feature = "mssql-errors")]
impl From<tiberius::error::Error> for DbError {
    fn from(err: tiberius::error::Error) -> Self {
        DbError::new("MSSQL_ERROR", err.to_string())
    }
}

#[cfg(feature = "mssql-errors")]
impl From<bb8_tiberius::Error> for DbError {
    fn from(err: bb8_tiberius::Error) -> Self {
        DbError::new("MSSQL_POOL_ERROR", err.to_string())
    }
}

#[cfg(feature = "mssql-errors")]
impl From<bb8::RunError<bb8_tiberius::Error>> for DbError {
    fn from(err: bb8::RunError<bb8_tiberius::Error>) -> Self {
        match err {
            bb8::RunError::User(inner) => inner.into(),
            bb8::RunError::TimedOut => {
                DbError::new("MSSQL_POOL_ERROR", "connection pool timed out")
            }
        }
    }
}
