use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppConfig {
    pub ai: Option<AISettings>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AISettings {
    pub provider: String,
    pub api_key: String,
    pub model: Option<String>,
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConfigError {
    pub code: String,
    pub message: String,
}

impl From<std::io::Error> for ConfigError {
    fn from(err: std::io::Error) -> Self {
        ConfigError {
            code: "IO_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ConfigError {
    fn from(err: serde_json::Error) -> Self {
        ConfigError {
            code: "JSON_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

fn config_path() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home.join(".config").join("oh-my-query").join("oh-my-query.json"))
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, ConfigError> {
    let path = config_path()?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: AppConfig = serde_json::from_str(&content)?;
    Ok(config)
}

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), ConfigError> {
    let path = config_path()?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let content = serde_json::to_string_pretty(&config)?;
    tokio::fs::write(&path, content).await?;
    Ok(())
}
