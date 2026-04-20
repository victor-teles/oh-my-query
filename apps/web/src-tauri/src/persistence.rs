use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

use crate::config::ConfigError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedTab {
    pub id: String,
    pub title: String,
    pub sql: String,
    pub source_dialect: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TabState {
    pub tabs: Vec<PersistedTab>,
    pub active_tab_id: String,
    pub counter: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub sql: String,
    pub connection_id: String,
    pub database: Option<String>,
    pub timestamp: String,
    pub success: bool,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConnection {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub created_at: String,
    pub pinned: bool,
    pub last_connected_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nickname: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
}

const MAX_HISTORY_ENTRIES: usize = 10_000;

fn connections_path() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home
        .join(".config")
        .join("oh-my-query")
        .join("connections.json"))
}

fn tabs_path(connection_id: &str) -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home
        .join(".config")
        .join("oh-my-query")
        .join("tabs")
        .join(format!("{connection_id}.json")))
}

fn history_path(connection_id: &str) -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home
        .join(".config")
        .join("oh-my-query")
        .join("history")
        .join(format!("{connection_id}.jsonl")))
}

async fn ensure_parent_dir(path: &Path) -> Result<(), ConfigError> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    Ok(())
}

async fn enforce_history_limit(path: &Path) -> Result<(), ConfigError> {
    let content = tokio::fs::read_to_string(path).await?;
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= MAX_HISTORY_ENTRIES {
        return Ok(());
    }
    let trimmed: String = lines[lines.len() - MAX_HISTORY_ENTRIES..].join("\n");
    let mut output = trimmed;
    output.push('\n');
    tokio::fs::write(path, output).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_tabs(connection_id: String) -> Result<Option<TabState>, ConfigError> {
    let path = tabs_path(&connection_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let state: TabState = serde_json::from_str(&content)?;
    Ok(Some(state))
}

#[tauri::command]
pub async fn save_tabs(connection_id: String, state: TabState) -> Result<(), ConfigError> {
    let path = tabs_path(&connection_id)?;
    ensure_parent_dir(&path).await?;
    let content = serde_json::to_string_pretty(&state)?;
    tokio::fs::write(&path, content).await?;
    Ok(())
}

#[tauri::command]
pub async fn append_history(entry: HistoryEntry) -> Result<(), ConfigError> {
    let path = history_path(&entry.connection_id)?;
    ensure_parent_dir(&path).await?;

    let mut line = serde_json::to_string(&entry)?;
    line.push('\n');

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .await?;
    file.write_all(line.as_bytes()).await?;

    enforce_history_limit(&path).await?;

    Ok(())
}

#[tauri::command]
pub async fn get_history(
    connection_id: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<HistoryEntry>, ConfigError> {
    let path = history_path(&connection_id)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let mut entries: Vec<HistoryEntry> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();

    entries.reverse();

    let offset = offset.unwrap_or(0) as usize;
    let limit = limit.unwrap_or(100) as usize;

    Ok(entries.into_iter().skip(offset).take(limit).collect())
}

#[tauri::command]
pub async fn get_connections() -> Result<Vec<DatabaseConnection>, ConfigError> {
    let path = connections_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let connections: Vec<DatabaseConnection> = serde_json::from_str(&content)?;
    Ok(connections)
}

#[tauri::command]
pub async fn save_connections(connections: Vec<DatabaseConnection>) -> Result<(), ConfigError> {
    let path = connections_path()?;
    ensure_parent_dir(&path).await?;
    let content = serde_json::to_string_pretty(&connections)?;
    tokio::fs::write(&path, content).await?;
    Ok(())
}
