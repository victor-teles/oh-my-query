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
    pub fn cancelled() -> Self {
        DbError {
            code: "QUERY_CANCELLED".to_string(),
            message: "Query cancelled".to_string(),
        }
    }
}

impl From<tokio::time::error::Elapsed> for DbError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        DbError {
            code: "QUERY_TIMEOUT".to_string(),
            message: "Query exceeded the configured timeout".to_string(),
        }
    }
}

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

impl From<mongodb::error::Error> for DbError {
    fn from(err: mongodb::error::Error) -> Self {
        DbError {
            code: "MONGO_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<redis::RedisError> for DbError {
    fn from(err: redis::RedisError) -> Self {
        DbError {
            code: "REDIS_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<reqwest::Error> for DbError {
    fn from(err: reqwest::Error) -> Self {
        DbError {
            code: "CLICKHOUSE_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}
