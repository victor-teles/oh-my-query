use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex as AsyncMutex;

use crate::config::ConfigError;
use crate::crypto;

static HISTORY_FILE_LOCKS: OnceLock<AsyncMutex<HashMap<PathBuf, Arc<AsyncMutex<()>>>>> =
    OnceLock::new();

async fn history_file_lock(path: &Path) -> Arc<AsyncMutex<()>> {
    let registry = HISTORY_FILE_LOCKS.get_or_init(|| AsyncMutex::new(HashMap::new()));
    let mut map = registry.lock().await;
    map.entry(path.to_path_buf())
        .or_insert_with(|| Arc::new(AsyncMutex::new(())))
        .clone()
}

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dialect: Option<String>,
    pub database: Option<String>,
    pub timestamp: String,
    pub success: bool,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFilters {
    #[serde(default)]
    pub connection_ids: Option<Vec<String>>,
    #[serde(default)]
    pub dialects: Option<Vec<String>>,
    #[serde(default)]
    pub min_runtime_ms: Option<u64>,
    #[serde(default)]
    pub max_runtime_ms: Option<u64>,
    #[serde(default)]
    pub errored_only: Option<bool>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
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

fn history_dir() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home.join(".config").join("oh-my-query").join("history"))
}

fn history_path(connection_id: &str) -> Result<PathBuf, ConfigError> {
    Ok(history_dir()?.join(format!("{connection_id}.jsonl")))
}

async fn ensure_parent_dir(path: &Path) -> Result<(), ConfigError> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    Ok(())
}

/// Decode a single history line. Lines written before the encryption rollout
/// are raw JSON starting with `{`; lines written after are base64 AEAD blobs.
/// Returns `(entry, was_plaintext)` so the caller can migrate the file.
fn decode_line(line: &str) -> Option<(HistoryEntry, bool)> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with('{') {
        return serde_json::from_str::<HistoryEntry>(trimmed)
            .ok()
            .map(|entry| (entry, true));
    }
    let decrypted = crypto::decrypt_line(trimmed).ok()?;
    serde_json::from_str::<HistoryEntry>(&decrypted)
        .ok()
        .map(|entry| (entry, false))
}

async fn read_entries(path: &Path) -> Result<(Vec<HistoryEntry>, bool), ConfigError> {
    let content = tokio::fs::read_to_string(path).await?;
    let mut entries = Vec::new();
    let mut needs_migration = false;
    for line in content.lines() {
        if let Some((entry, was_plaintext)) = decode_line(line) {
            if was_plaintext {
                needs_migration = true;
            }
            entries.push(entry);
        }
    }
    Ok((entries, needs_migration))
}

async fn rewrite_encrypted(path: &Path, entries: &[HistoryEntry]) -> Result<(), ConfigError> {
    let mut out = String::new();
    for entry in entries {
        let json = serde_json::to_string(entry)?;
        let encrypted = crypto::encrypt_line(&json)?;
        out.push_str(&encrypted);
        out.push('\n');
    }
    tokio::fs::write(path, out).await?;
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

fn matches_filters(entry: &HistoryEntry, filters: &HistoryFilters) -> bool {
    if let Some(ids) = &filters.connection_ids {
        if !ids.is_empty() && !ids.iter().any(|id| id == &entry.connection_id) {
            return false;
        }
    }
    if let Some(dialects) = &filters.dialects {
        if !dialects.is_empty() {
            let dialect = entry.dialect.as_deref().unwrap_or("");
            if !dialects.iter().any(|d| d == dialect) {
                return false;
            }
        }
    }
    if let Some(min) = filters.min_runtime_ms {
        if entry.execution_time_ms < min {
            return false;
        }
    }
    if let Some(max) = filters.max_runtime_ms {
        if entry.execution_time_ms > max {
            return false;
        }
    }
    if filters.errored_only.unwrap_or(false) && entry.success {
        return false;
    }
    if let Some(q) = &filters.query {
        let needle = q.trim().to_lowercase();
        if !needle.is_empty() && !entry.sql.to_lowercase().contains(&needle) {
            return false;
        }
    }
    true
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

    let json = serde_json::to_string(&entry)?;
    let encrypted = crypto::encrypt_line(&json)?;
    let mut line = encrypted;
    line.push('\n');

    let lock = history_file_lock(&path).await;
    let _guard = lock.lock().await;

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

    let lock = history_file_lock(&path).await;
    let mut entries = {
        let _guard = lock.lock().await;
        let (entries, needs_migration) = read_entries(&path).await?;
        if needs_migration {
            // Best-effort migration: if encryption is available we re-write encrypted.
            // If it fails (e.g. keyring unavailable), just leave the file as-is.
            let _ = rewrite_encrypted(&path, &entries).await;
        }
        entries
    };

    entries.reverse();

    let offset = offset.unwrap_or(0) as usize;
    let limit = limit.unwrap_or(100) as usize;

    Ok(entries.into_iter().skip(offset).take(limit).collect())
}

#[tauri::command]
pub async fn get_all_history(
    filters: Option<HistoryFilters>,
) -> Result<Vec<HistoryEntry>, ConfigError> {
    let dir = history_dir()?;
    if !dir.exists() {
        return Ok(vec![]);
    }

    let filters = filters.unwrap_or_default();

    let mut read_dir = tokio::fs::read_dir(&dir).await?;
    let mut all: Vec<HistoryEntry> = Vec::new();

    while let Some(entry) = read_dir.next_entry().await? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
            continue;
        }
        let lock = history_file_lock(&path).await;
        let entries = {
            let _guard = lock.lock().await;
            let (entries, needs_migration) = match read_entries(&path).await {
                Ok(pair) => pair,
                Err(_) => continue,
            };
            if needs_migration {
                let _ = rewrite_encrypted(&path, &entries).await;
            }
            entries
        };
        for e in entries {
            if matches_filters(&e, &filters) {
                all.push(e);
            }
        }
    }

    all.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let offset = filters.offset.unwrap_or(0) as usize;
    let limit = filters.limit.unwrap_or(500) as usize;

    Ok(all.into_iter().skip(offset).take(limit).collect())
}

fn looks_like_plaintext_json(s: &str) -> bool {
    matches!(s.trim_start().chars().next(), Some('[' | '{'))
}

async fn write_encrypted_connections(
    path: &Path,
    connections: &[DatabaseConnection],
) -> Result<(), ConfigError> {
    ensure_parent_dir(path).await?;
    let json = serde_json::to_string(connections)?;
    let encrypted = crypto::encrypt_line(&json)?;
    tokio::fs::write(path, encrypted).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_connections() -> Result<Vec<DatabaseConnection>, ConfigError> {
    let path = connections_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    // Migration path: pre-encryption installs wrote raw JSON. Decode, then
    // re-save encrypted on a best-effort basis so the plaintext doesn't
    // linger on disk.
    if looks_like_plaintext_json(trimmed) {
        let connections: Vec<DatabaseConnection> = serde_json::from_str(trimmed)?;
        let _ = write_encrypted_connections(&path, &connections).await;
        return Ok(connections);
    }

    let plaintext = crypto::decrypt_line(trimmed)?;
    let connections: Vec<DatabaseConnection> = serde_json::from_str(&plaintext)?;
    Ok(connections)
}

#[tauri::command]
pub async fn save_connections(connections: Vec<DatabaseConnection>) -> Result<(), ConfigError> {
    let path = connections_path()?;
    write_encrypted_connections(&path, &connections).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    #[tokio::test]
    async fn same_path_serializes_critical_sections() {
        let path = std::env::temp_dir().join("oh-my-query-history-lock-test-a.jsonl");
        let in_flight = Arc::new(AtomicUsize::new(0));
        let max_concurrent = Arc::new(AtomicUsize::new(0));

        let mut handles = Vec::new();
        for _ in 0..8 {
            let path = path.clone();
            let in_flight = Arc::clone(&in_flight);
            let max_concurrent = Arc::clone(&max_concurrent);
            handles.push(tokio::spawn(async move {
                let lock = history_file_lock(&path).await;
                let _guard = lock.lock().await;
                let current = in_flight.fetch_add(1, Ordering::SeqCst) + 1;
                max_concurrent.fetch_max(current, Ordering::SeqCst);
                tokio::time::sleep(Duration::from_millis(5)).await;
                in_flight.fetch_sub(1, Ordering::SeqCst);
            }));
        }
        for h in handles {
            h.await.unwrap();
        }

        assert_eq!(
            max_concurrent.load(Ordering::SeqCst),
            1,
            "critical sections on the same path must not overlap",
        );
    }

    #[tokio::test]
    async fn distinct_paths_do_not_block_each_other() {
        let path_a = std::env::temp_dir().join("oh-my-query-history-lock-test-b.jsonl");
        let path_b = std::env::temp_dir().join("oh-my-query-history-lock-test-c.jsonl");

        let lock_a = history_file_lock(&path_a).await;
        let lock_b = history_file_lock(&path_b).await;

        let guard_a = lock_a.lock().await;

        // Grabbing the second, different-path lock must succeed without waiting
        // on `guard_a`. `try_lock` returning `Ok` proves the locks are independent.
        let guard_b = lock_b
            .try_lock()
            .expect("distinct paths must use distinct locks");

        drop(guard_b);
        drop(guard_a);
    }
}
