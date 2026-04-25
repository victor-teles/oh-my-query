use log::warn;
use serde::{Deserialize, Serialize};
use std::cmp::{Ordering, Reverse};
use std::collections::{BinaryHeap, HashMap};
use std::ffi::OsString;
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
const DEFAULT_ALL_HISTORY_LIMIT: usize = 500;

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

fn tmp_sibling(path: &Path) -> PathBuf {
    let mut ext = path.extension().map(OsString::from).unwrap_or_default();
    if !ext.is_empty() {
        ext.push(".tmp");
    } else {
        ext.push("tmp");
    }
    path.with_extension(ext)
}

async fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), ConfigError> {
    let tmp = tmp_sibling(path);
    tokio::fs::write(&tmp, bytes).await?;
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

enum DecodedLine {
    Empty,
    Plaintext(HistoryEntry),
    Encrypted(HistoryEntry),
}

fn decode_line(line: &str) -> Result<DecodedLine, ConfigError> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(DecodedLine::Empty);
    }
    if trimmed.starts_with('{') {
        return match serde_json::from_str::<HistoryEntry>(trimmed) {
            Ok(entry) => Ok(DecodedLine::Plaintext(entry)),
            Err(_) => Ok(DecodedLine::Empty),
        };
    }
    let decrypted = crypto::decrypt_line(trimmed)?;
    let entry: HistoryEntry = serde_json::from_str(&decrypted)?;
    Ok(DecodedLine::Encrypted(entry))
}

async fn read_entries(path: &Path) -> Result<(Vec<HistoryEntry>, bool), ConfigError> {
    let content = tokio::fs::read_to_string(path).await?;
    let mut entries = Vec::new();
    let mut needs_migration = false;
    for line in content.lines() {
        match decode_line(line)? {
            DecodedLine::Empty => {}
            DecodedLine::Plaintext(entry) => {
                needs_migration = true;
                entries.push(entry);
            }
            DecodedLine::Encrypted(entry) => {
                entries.push(entry);
            }
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
    atomic_write(path, out.as_bytes()).await
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
    atomic_write(path, output.as_bytes()).await
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

struct ByTimestamp(HistoryEntry);

impl PartialEq for ByTimestamp {
    fn eq(&self, other: &Self) -> bool {
        self.0.timestamp == other.0.timestamp
    }
}

impl Eq for ByTimestamp {}

impl PartialOrd for ByTimestamp {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ByTimestamp {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.timestamp.cmp(&other.0.timestamp)
    }
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
            if let Err(err) = rewrite_encrypted(&path, &entries).await {
                warn!(
                    "failed to migrate history file {} to encrypted: {}",
                    path.display(),
                    err.message
                );
            }
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

    let offset = filters.offset.unwrap_or(0) as usize;
    let limit = filters
        .limit
        .map(|l| l as usize)
        .unwrap_or(DEFAULT_ALL_HISTORY_LIMIT);
    let capacity = offset.saturating_add(limit);
    if capacity == 0 {
        return Ok(vec![]);
    }

    let mut read_dir = tokio::fs::read_dir(&dir).await?;
    let mut heap: BinaryHeap<Reverse<ByTimestamp>> = BinaryHeap::with_capacity(capacity);

    while let Some(dir_entry) = read_dir.next_entry().await? {
        let path = dir_entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
            continue;
        }
        let lock = history_file_lock(&path).await;
        let file_entries = {
            let _guard = lock.lock().await;
            match read_entries(&path).await {
                Ok((entries, needs_migration)) => {
                    if needs_migration {
                        if let Err(err) = rewrite_encrypted(&path, &entries).await {
                            warn!(
                                "failed to migrate history file {} to encrypted: {}",
                                path.display(),
                                err.message
                            );
                        }
                    }
                    entries
                }
                Err(err) => {
                    warn!(
                        "failed to read history file {}: {}",
                        path.display(),
                        err.message
                    );
                    continue;
                }
            }
        };

        for entry in file_entries {
            if !matches_filters(&entry, &filters) {
                continue;
            }
            if heap.len() < capacity {
                heap.push(Reverse(ByTimestamp(entry)));
            } else if let Some(Reverse(min)) = heap.peek() {
                if entry.timestamp > min.0.timestamp {
                    heap.pop();
                    heap.push(Reverse(ByTimestamp(entry)));
                }
            }
        }
    }

    let mut result: Vec<HistoryEntry> = heap
        .into_iter()
        .map(|Reverse(ByTimestamp(entry))| entry)
        .collect();
    result.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(result.into_iter().skip(offset).take(limit).collect())
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
    atomic_write(path, encrypted.as_bytes()).await
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

    if looks_like_plaintext_json(trimmed) {
        let connections: Vec<DatabaseConnection> = serde_json::from_str(trimmed)?;
        if let Err(err) = write_encrypted_connections(&path, &connections).await {
            warn!(
                "failed to migrate connections file {} to encrypted: {}",
                path.display(),
                err.message
            );
        }
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

        let guard_b = lock_b
            .try_lock()
            .expect("distinct paths must use distinct locks");

        drop(guard_b);
        drop(guard_a);
    }

    #[tokio::test]
    async fn atomic_write_replaces_file_and_cleans_tmp() {
        let dir = std::env::temp_dir().join("oh-my-query-atomic-write-test");
        tokio::fs::create_dir_all(&dir).await.unwrap();
        let path = dir.join("target.jsonl");
        tokio::fs::write(&path, b"old contents").await.unwrap();

        atomic_write(&path, b"fresh contents").await.unwrap();

        let got = tokio::fs::read_to_string(&path).await.unwrap();
        assert_eq!(got, "fresh contents");

        let tmp = tmp_sibling(&path);
        assert!(
            !tmp.exists(),
            "atomic_write should rename the tmp sibling into place",
        );
    }

    #[test]
    fn tmp_sibling_preserves_extension() {
        let path = PathBuf::from("/tmp/foo/bar.jsonl");
        assert_eq!(tmp_sibling(&path), PathBuf::from("/tmp/foo/bar.jsonl.tmp"));

        let no_ext = PathBuf::from("/tmp/foo/bar");
        assert_eq!(tmp_sibling(&no_ext), PathBuf::from("/tmp/foo/bar.tmp"));
    }
}
