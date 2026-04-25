use std::path::PathBuf;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

use crate::config::ConfigError;

pub const STABLE: &str = "stable";
pub const BETA: &str = "beta";
pub const NIGHTLY: &str = "nightly";

const APPCAST_BASE: &str = "https://github.com/victor-teles/oh-my-query/releases/download";

pub fn channel_path() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or_else(|| ConfigError {
        code: "HOME_NOT_FOUND".to_string(),
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home
        .join(".config")
        .join("oh-my-query")
        .join("update-channel.txt"))
}

pub fn normalize(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        STABLE => Some(STABLE),
        BETA => Some(BETA),
        NIGHTLY => Some(NIGHTLY),
        _ => None,
    }
}

pub async fn read_channel() -> Result<&'static str, ConfigError> {
    let path = channel_path()?;
    if !path.exists() {
        return Ok(STABLE);
    }
    let content = tokio::fs::read_to_string(&path).await?;
    Ok(normalize(&content).unwrap_or(STABLE))
}

pub async fn write_channel(channel: &str) -> Result<&'static str, ConfigError> {
    let canonical = normalize(channel).ok_or_else(|| ConfigError {
        code: "INVALID_CHANNEL".to_string(),
        message: format!("Unknown update channel: {channel}"),
    })?;
    let path = channel_path()?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&path, canonical.as_bytes()).await?;
    Ok(canonical)
}

pub fn appcast_url(channel: &str) -> String {
    let canonical = normalize(channel).unwrap_or(STABLE);
    format!("{APPCAST_BASE}/updater-{canonical}/latest.json")
}

#[tauri::command]
pub async fn get_update_channel() -> Result<&'static str, ConfigError> {
    read_channel().await
}

#[tauri::command]
pub async fn set_update_channel(channel: String) -> Result<&'static str, ConfigError> {
    write_channel(&channel).await
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
}

fn build_endpoint(channel: &str) -> Result<tauri::Url, String> {
    tauri::Url::parse(&appcast_url(channel)).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<AvailableUpdate>, String> {
    let channel = read_channel().await.map_err(|err| err.message)?;
    let endpoint = build_endpoint(channel)?;
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())?;

    match updater.check().await.map_err(|err| err.to_string())? {
        Some(update) => Ok(Some(AvailableUpdate {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        })),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<bool, String> {
    let channel = read_channel().await.map_err(|err| err.message)?;
    let endpoint = build_endpoint(channel)?;
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())?;

    let Some(update) = updater.check().await.map_err(|err| err.to_string())? else {
        return Ok(false);
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| err.to_string())?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_accepts_known_channels() {
        assert_eq!(normalize("stable"), Some(STABLE));
        assert_eq!(normalize("BETA"), Some(BETA));
        assert_eq!(normalize("  nightly  "), Some(NIGHTLY));
    }

    #[test]
    fn normalize_rejects_unknown() {
        assert_eq!(normalize("alpha"), None);
        assert_eq!(normalize(""), None);
    }

    #[test]
    fn appcast_url_uses_canonical_channel() {
        assert!(appcast_url("stable").ends_with("/updater-stable/latest.json"));
        assert!(appcast_url("BETA").ends_with("/updater-beta/latest.json"));
        assert!(appcast_url("garbage").ends_with("/updater-stable/latest.json"));
    }

    #[tokio::test]
    async fn write_then_read_roundtrips() {
        let path = channel_path().unwrap();
        let backup = if path.exists() {
            Some(tokio::fs::read_to_string(&path).await.unwrap())
        } else {
            None
        };

        write_channel("beta").await.unwrap();
        assert_eq!(read_channel().await.unwrap(), BETA);

        write_channel("STABLE").await.unwrap();
        assert_eq!(read_channel().await.unwrap(), STABLE);

        match backup {
            Some(content) => tokio::fs::write(&path, content).await.unwrap(),
            None => {
                let _ = tokio::fs::remove_file(&path).await;
            }
        }
    }

    #[tokio::test]
    async fn write_rejects_unknown_channel() {
        let err = write_channel("alpha").await.expect_err("expected error");
        assert_eq!(err.code, "INVALID_CHANNEL");
    }
}
