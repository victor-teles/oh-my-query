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
