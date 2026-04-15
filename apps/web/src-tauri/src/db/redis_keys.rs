use crate::db::error::DbError;
use crate::db::types::{RedisDbInfo, RedisKey, RedisKeyKind, RedisScanPage};

const DEFAULT_COUNT: u32 = 200;
const MAX_COUNT: u32 = 1_000;
const MAX_PAGE_KEYS: usize = 500;

pub fn classify_kind(raw: &str) -> RedisKeyKind {
    match raw {
        "string" => RedisKeyKind::String,
        "hash" => RedisKeyKind::Hash,
        "list" => RedisKeyKind::List,
        "set" => RedisKeyKind::Set,
        "zset" => RedisKeyKind::Zset,
        "stream" => RedisKeyKind::Stream,
        _ => RedisKeyKind::Unknown,
    }
}

pub fn size_unit_for(kind: &RedisKeyKind) -> &'static str {
    match kind {
        RedisKeyKind::String => "bytes",
        RedisKeyKind::Hash => "fields",
        RedisKeyKind::List => "items",
        RedisKeyKind::Set => "members",
        RedisKeyKind::Zset => "members",
        RedisKeyKind::Stream => "entries",
        RedisKeyKind::Unknown => "",
    }
}

fn size_command(kind: &RedisKeyKind) -> Option<&'static str> {
    match kind {
        RedisKeyKind::String => Some("STRLEN"),
        RedisKeyKind::Hash => Some("HLEN"),
        RedisKeyKind::List => Some("LLEN"),
        RedisKeyKind::Set => Some("SCARD"),
        RedisKeyKind::Zset => Some("ZCARD"),
        RedisKeyKind::Stream => Some("XLEN"),
        RedisKeyKind::Unknown => None,
    }
}

async fn select_db(
    conn: &mut redis::aio::MultiplexedConnection,
    db_index: u8,
) -> Result<(), DbError> {
    let _: redis::Value = redis::cmd("SELECT")
        .arg(db_index)
        .query_async(conn)
        .await
        .map_err(DbError::from)?;
    Ok(())
}

pub async fn redis_db_info(
    conn: &redis::aio::MultiplexedConnection,
    db_index: u8,
) -> Result<RedisDbInfo, DbError> {
    let mut c = conn.clone();
    select_db(&mut c, db_index).await?;

    let total_keys: u64 = redis::cmd("DBSIZE")
        .query_async(&mut c)
        .await
        .map_err(DbError::from)?;

    let memory_bytes: Option<u64> = match redis::cmd("INFO")
        .arg("memory")
        .query_async::<String>(&mut c)
        .await
    {
        Ok(info) => info
            .lines()
            .find_map(|line| line.strip_prefix("used_memory:"))
            .and_then(|v| v.trim().parse::<u64>().ok()),
        Err(_) => None,
    };

    Ok(RedisDbInfo {
        total_keys,
        memory_bytes,
    })
}

pub async fn scan_redis_keys(
    conn: &redis::aio::MultiplexedConnection,
    db_index: u8,
    pattern: Option<&str>,
    cursor: &str,
    count: Option<u32>,
) -> Result<RedisScanPage, DbError> {
    let mut c = conn.clone();
    select_db(&mut c, db_index).await?;

    let count = count.unwrap_or(DEFAULT_COUNT).min(MAX_COUNT).max(10);
    let mut names: Vec<String> = Vec::new();
    let mut current_cursor = cursor.to_string();

    loop {
        let mut cmd = redis::cmd("SCAN");
        cmd.arg(&current_cursor);
        if let Some(p) = pattern.filter(|p| !p.is_empty()) {
            cmd.arg("MATCH").arg(p);
        }
        cmd.arg("COUNT").arg(count);

        let (next, batch): (String, Vec<String>) =
            cmd.query_async(&mut c).await.map_err(DbError::from)?;

        for name in batch {
            if names.len() >= MAX_PAGE_KEYS {
                break;
            }
            names.push(name);
        }

        current_cursor = next;

        if current_cursor == "0" || names.len() >= MAX_PAGE_KEYS {
            break;
        }
        if pattern.filter(|p| !p.is_empty()).is_none() && !names.is_empty() {
            break;
        }
    }

    let sampled = names.len() as u64;
    let mut keys: Vec<RedisKey> = Vec::with_capacity(names.len());

    for name in names {
        let kind_raw: String = match redis::cmd("TYPE")
            .arg(&name)
            .query_async::<String>(&mut c)
            .await
        {
            Ok(k) => k,
            Err(_) => continue,
        };
        let kind = classify_kind(&kind_raw);
        if matches!(kind, RedisKeyKind::Unknown) {
            continue;
        }

        let ttl_secs: Option<i64> = redis::cmd("TTL")
            .arg(&name)
            .query_async::<i64>(&mut c)
            .await
            .ok()
            .and_then(|v| match v {
                -2 => None,
                -1 => None,
                secs if secs >= 0 => Some(secs),
                _ => None,
            });

        let size = if let Some(cmd_name) = size_command(&kind) {
            redis::cmd(cmd_name)
                .arg(&name)
                .query_async::<u64>(&mut c)
                .await
                .ok()
        } else {
            None
        };

        let size_unit = size_unit_for(&kind);

        keys.push(RedisKey {
            name,
            kind,
            ttl_secs,
            size,
            size_unit,
        });
    }

    keys.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(RedisScanPage {
        keys,
        next_cursor: current_cursor,
        sampled,
    })
}

pub async fn delete_redis_key(
    conn: &redis::aio::MultiplexedConnection,
    db_index: u8,
    name: &str,
) -> Result<u64, DbError> {
    let mut c = conn.clone();
    select_db(&mut c, db_index).await?;

    let removed: u64 = redis::cmd("DEL")
        .arg(name)
        .query_async(&mut c)
        .await
        .map_err(DbError::from)?;

    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_known_kinds() {
        assert!(matches!(classify_kind("string"), RedisKeyKind::String));
        assert!(matches!(classify_kind("hash"), RedisKeyKind::Hash));
        assert!(matches!(classify_kind("list"), RedisKeyKind::List));
        assert!(matches!(classify_kind("set"), RedisKeyKind::Set));
        assert!(matches!(classify_kind("zset"), RedisKeyKind::Zset));
        assert!(matches!(classify_kind("stream"), RedisKeyKind::Stream));
    }

    #[test]
    fn classifies_unknown_kind() {
        assert!(matches!(classify_kind("futuretype"), RedisKeyKind::Unknown));
    }

    #[test]
    fn size_units_match_kinds() {
        assert_eq!(size_unit_for(&RedisKeyKind::String), "bytes");
        assert_eq!(size_unit_for(&RedisKeyKind::Hash), "fields");
        assert_eq!(size_unit_for(&RedisKeyKind::List), "items");
        assert_eq!(size_unit_for(&RedisKeyKind::Set), "members");
        assert_eq!(size_unit_for(&RedisKeyKind::Zset), "members");
        assert_eq!(size_unit_for(&RedisKeyKind::Stream), "entries");
    }

    #[test]
    fn size_command_for_unknown_is_none() {
        assert!(size_command(&RedisKeyKind::Unknown).is_none());
    }
}
