use std::any::Any;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use oh_my_query_core::error::DbError;
use oh_my_query_core::types::{
    ColumnInfo, ConnectionParams, ExecuteResult, RedisDbInfo, RedisKey, RedisKeyKind,
    RedisScanPage, SchemaInfo, SchemaItem, TestConnectionResult,
};
use oh_my_query_core::{Driver, Pool};

pub struct RedisDriver;

pub fn parse_redis_db_index(raw: &str) -> u8 {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return 0;
    }
    let rest = trimmed.strip_prefix("db").unwrap_or(trimmed);
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u8>().unwrap_or(0).min(15)
}

pub fn build_redis_url(params: &ConnectionParams) -> String {
    let db_index = parse_redis_db_index(&params.database);
    if params.password.is_empty() {
        format!("redis://{}:{}/{}", params.host, params.port, db_index)
    } else {
        format!(
            "redis://:{}@{}:{}/{}",
            urlencoding::encode(&params.password),
            params.host,
            params.port,
            db_index,
        )
    }
}

pub struct RedisPool {
    pub conn: redis::aio::MultiplexedConnection,
    pub client: redis::Client,
}

impl RedisPool {
    pub fn connection(&self) -> redis::aio::MultiplexedConnection {
        self.conn.clone()
    }

    pub fn client(&self) -> &redis::Client {
        &self.client
    }
}

#[async_trait]
impl Driver for RedisDriver {
    fn db_type(&self) -> &'static str {
        "redis"
    }

    async fn test_connection(
        &self,
        params: &ConnectionParams,
    ) -> Result<TestConnectionResult, DbError> {
        let start = Instant::now();

        let url = build_redis_url(params);
        let client = redis::Client::open(url.as_str()).map_err(DbError::from)?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(DbError::from)?;

        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(DbError::from)?;

        let latency_ms = start.elapsed().as_millis() as u64;

        Ok(TestConnectionResult {
            success: true,
            message: "Connection successful".to_string(),
            latency_ms,
        })
    }

    async fn connect(
        &self,
        _id: &str,
        params: &ConnectionParams,
    ) -> Result<Arc<dyn Pool>, DbError> {
        let url = build_redis_url(params);
        let client = redis::Client::open(url.as_str()).map_err(DbError::from)?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(DbError::from)?;

        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(DbError::from)?;

        Ok(Arc::new(RedisPool { conn, client }))
    }
}

#[async_trait]
impl Pool for RedisPool {
    async fn fetch_version(&self) -> Result<String, DbError> {
        let info: String = redis::cmd("INFO")
            .arg("server")
            .query_async(&mut self.conn.clone())
            .await
            .map_err(DbError::from)?;
        let version = info
            .lines()
            .find(|l| l.starts_with("redis_version:"))
            .and_then(|l| l.strip_prefix("redis_version:"))
            .unwrap_or("unknown")
            .trim();
        Ok(format!("Redis {version}"))
    }

    async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        Ok((0u8..16).map(|i| format!("db{i}")).collect())
    }

    async fn fetch_schema(&self, database: &str) -> Result<SchemaInfo, DbError> {
        Ok(SchemaInfo {
            schemas: vec![SchemaItem {
                name: database.to_string(),
                tables: vec![],
                views: vec![],
            }],
        })
    }

    async fn execute(
        &self,
        command: &str,
        _max_rows: usize,
        _schema: Option<&str>,
    ) -> Result<ExecuteResult, DbError> {
        execute_redis(&mut self.conn.clone(), command).await
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[cfg(test)]
mod parse_redis_db_index_tests {
    use super::*;

    #[test]
    fn parse_plain_digits() {
        assert_eq!(parse_redis_db_index("3"), 3);
    }

    #[test]
    fn parse_db_prefixed() {
        assert_eq!(parse_redis_db_index("db5"), 5);
    }

    #[test]
    fn parse_suffixed_label() {
        assert_eq!(parse_redis_db_index("db10 (42 keys)"), 10);
    }

    #[test]
    fn parse_empty_defaults_to_zero() {
        assert_eq!(parse_redis_db_index(""), 0);
    }

    #[test]
    fn parse_clamps_to_15() {
        assert_eq!(parse_redis_db_index("99"), 15);
    }
}

// ---------------------------------------------------------------------------
// Redis-specific helpers (keys panel)
// ---------------------------------------------------------------------------

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

async fn select_db<C>(conn: &mut C, db_index: u8) -> Result<(), DbError>
where
    C: redis::aio::ConnectionLike + Send,
{
    let _: redis::Value = redis::cmd("SELECT")
        .arg(db_index)
        .query_async(conn)
        .await
        .map_err(DbError::from)?;
    Ok(())
}

async fn dedicated_conn(
    client: &redis::Client,
) -> Result<redis::aio::MultiplexedConnection, DbError> {
    client
        .get_multiplexed_tokio_connection()
        .await
        .map_err(DbError::from)
}

pub async fn redis_db_info(client: &redis::Client, db_index: u8) -> Result<RedisDbInfo, DbError> {
    let mut c = dedicated_conn(client).await?;
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
    client: &redis::Client,
    db_index: u8,
    pattern: Option<&str>,
    cursor: &str,
    count: Option<u32>,
) -> Result<RedisScanPage, DbError> {
    let mut c = dedicated_conn(client).await?;
    select_db(&mut c, db_index).await?;

    let count = count.unwrap_or(DEFAULT_COUNT).clamp(10, MAX_COUNT);
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
    client: &redis::Client,
    db_index: u8,
    name: &str,
) -> Result<u64, DbError> {
    let mut c = dedicated_conn(client).await?;
    select_db(&mut c, db_index).await?;

    let removed: u64 = redis::cmd("DEL")
        .arg(name)
        .query_async(&mut c)
        .await
        .map_err(DbError::from)?;

    Ok(removed)
}

#[cfg(test)]
mod redis_keys_tests {
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

// ---------------------------------------------------------------------------
// Redis command execution & rendering
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq, Eq)]
pub struct ParseError {
    pub message: String,
    pub position: usize,
}

pub fn parse_redis_args(input: &str) -> Result<Vec<String>, ParseError> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';
    let mut quote_start = 0usize;

    for (idx, ch) in input.char_indices() {
        if in_quotes {
            if ch == quote_char {
                in_quotes = false;
                args.push(std::mem::take(&mut current));
            } else if ch == '\\' {
                continue;
            } else {
                current.push(ch);
            }
        } else if ch == '"' || ch == '\'' {
            if !current.is_empty() {
                args.push(std::mem::take(&mut current));
            }
            in_quotes = true;
            quote_char = ch;
            quote_start = idx;
        } else if ch.is_whitespace() {
            if !current.is_empty() {
                args.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }

    if in_quotes {
        return Err(ParseError {
            message: format!("Unterminated {quote_char} quote"),
            position: quote_start,
        });
    }

    if !current.is_empty() {
        args.push(current);
    }

    Ok(args)
}

fn friendly_redis_error(err: &redis::RedisError, cmd_name: &str) -> DbError {
    let raw = err.to_string();
    let upper = raw.to_uppercase();

    let (code, hint) = if upper.contains("WRONGTYPE") {
        (
            "REDIS_WRONG_TYPE",
            format!(
                " — `{cmd_name}` doesn't match the value's data type. Check `TYPE <key>` first."
            ),
        )
    } else if upper.contains("NOAUTH") || upper.contains("AUTH") {
        (
            "REDIS_AUTH_REQUIRED",
            " — authentication required. Check the connection password.".to_string(),
        )
    } else if upper.contains("READONLY") {
        (
            "REDIS_READONLY",
            " — server is in read-only mode (replica). Connect to the primary to write."
                .to_string(),
        )
    } else if upper.contains("LOADING") {
        (
            "REDIS_LOADING",
            " — Redis is still loading the dataset. Try again shortly.".to_string(),
        )
    } else if upper.contains("MOVED") || upper.contains("ASK") {
        (
            "REDIS_CLUSTER_REDIRECT",
            " — cluster redirect. Cluster mode isn't supported yet; connect directly to the target node.".to_string(),
        )
    } else if upper.contains("ERR UNKNOWN COMMAND") {
        (
            "REDIS_UNKNOWN_COMMAND",
            format!(" — `{cmd_name}` isn't a known Redis command."),
        )
    } else if upper.contains("ERR WRONG NUMBER OF ARGUMENTS") {
        (
            "REDIS_WRONG_ARGS",
            format!(" — wrong number of arguments for `{cmd_name}`."),
        )
    } else {
        ("REDIS_ERROR", String::new())
    };

    DbError {
        code: code.to_string(),
        message: format!("{raw}{hint}"),
    }
}

pub async fn execute_redis(
    conn: &mut redis::aio::MultiplexedConnection,
    command: &str,
) -> Result<ExecuteResult, DbError> {
    let parts = parse_redis_args(command.trim()).map_err(|e| DbError {
        code: "REDIS_PARSE_ERROR".to_string(),
        message: format!("{} at position {}", e.message, e.position),
    })?;
    if parts.is_empty() {
        return Err(DbError {
            code: "REDIS_PARSE_ERROR".to_string(),
            message: "Empty Redis command".to_string(),
        });
    }

    let cmd_name = parts[0].to_uppercase();
    let mut cmd = redis::cmd(&cmd_name);
    for arg in &parts[1..] {
        cmd.arg(arg.as_str());
    }

    let value: redis::Value = cmd
        .query_async(conn)
        .await
        .map_err(|err| friendly_redis_error(&err, &cmd_name))?;

    Ok(render_redis_value(
        &value,
        &cmd_name,
        &parts.iter().map(String::as_str).collect::<Vec<_>>(),
    ))
}

fn render_redis_value(value: &redis::Value, cmd_name: &str, args: &[&str]) -> ExecuteResult {
    let shape = RedisResultShape::infer(cmd_name, args);
    shape.render(value, cmd_name)
}

enum RedisResultShape {
    FieldValue,
    IndexedValue,
    Member,
    MemberScore,
    StreamEntries,
    InfoLines,
    Scan,
    ClientList,
    Auto,
}

impl RedisResultShape {
    fn infer(cmd: &str, args: &[&str]) -> Self {
        match cmd {
            "HGETALL" | "HSCAN" | "CONFIG" => Self::FieldValue,
            "HKEYS" | "HVALS" | "HMGET" | "SMEMBERS" | "SINTER" | "SUNION" | "SDIFF"
            | "SRANDMEMBER" => Self::Member,
            "LRANGE" | "LPOP" | "RPOP" | "LPUSH" | "RPUSH" => Self::IndexedValue,
            "ZRANGE" | "ZREVRANGE" | "ZRANGEBYSCORE" | "ZREVRANGEBYSCORE" | "ZPOPMIN"
            | "ZPOPMAX" => {
                if args.iter().any(|a| a.eq_ignore_ascii_case("WITHSCORES"))
                    || matches!(cmd, "ZPOPMIN" | "ZPOPMAX")
                {
                    Self::MemberScore
                } else {
                    Self::Member
                }
            }
            "XRANGE" | "XREVRANGE" | "XREAD" => Self::StreamEntries,
            "INFO" => Self::InfoLines,
            "SCAN" => Self::Scan,
            "CLIENT" => {
                if args.iter().any(|a| a.eq_ignore_ascii_case("LIST")) {
                    Self::ClientList
                } else {
                    Self::Auto
                }
            }
            _ => Self::Auto,
        }
    }

    fn render(&self, value: &redis::Value, cmd_name: &str) -> ExecuteResult {
        match self {
            Self::FieldValue => render_field_value(value, cmd_name),
            Self::IndexedValue => render_indexed(value),
            Self::Member => render_member(value),
            Self::MemberScore => render_member_score(value),
            Self::StreamEntries => render_stream(value),
            Self::InfoLines => render_info(value),
            Self::Scan => render_scan(value),
            Self::ClientList => render_client_list(value),
            Self::Auto => render_auto(value, cmd_name),
        }
    }
}

fn single_value_result(value: serde_json::Value, type_name: &str) -> ExecuteResult {
    ExecuteResult::Tabular {
        columns: vec![ColumnInfo {
            name: "value".to_string(),
            type_name: type_name.to_string(),
        }],
        rows: vec![vec![value]],
        row_count: 1,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_auto(value: &redis::Value, cmd_name: &str) -> ExecuteResult {
    match value {
        redis::Value::Nil => single_value_result(serde_json::Value::Null, "NULL"),
        redis::Value::Int(n) => {
            single_value_result(serde_json::Value::Number((*n).into()), "INTEGER")
        }
        redis::Value::BulkString(bytes) => {
            let s = String::from_utf8_lossy(bytes).to_string();
            single_value_result(maybe_parse_json(&s), "STRING")
        }
        redis::Value::SimpleString(s) => {
            single_value_result(serde_json::Value::String(s.clone()), "STRING")
        }
        redis::Value::Okay => {
            single_value_result(serde_json::Value::String("OK".to_string()), "STATUS")
        }
        redis::Value::Array(items) => {
            if items.is_empty() {
                return ExecuteResult::Tabular {
                    columns: vec![ColumnInfo {
                        name: "value".to_string(),
                        type_name: "EMPTY".to_string(),
                    }],
                    rows: vec![],
                    row_count: 0,
                    execution_time_ms: 0,
                    is_truncated: false,
                };
            }
            let rows: Vec<Vec<serde_json::Value>> = items
                .iter()
                .map(|item| vec![redis_value_to_json(item)])
                .collect();
            let row_count = rows.len() as u64;
            ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "value".to_string(),
                    type_name: type_name_for_cmd(cmd_name).to_string(),
                }],
                rows,
                row_count,
                execution_time_ms: 0,
                is_truncated: false,
            }
        }
        _ => single_value_result(serde_json::Value::String(format!("{value:?}")), "UNKNOWN"),
    }
}

fn type_name_for_cmd(cmd: &str) -> &'static str {
    match cmd {
        "KEYS" | "SCAN" => "KEY",
        _ => "VALUE",
    }
}

fn render_field_value(value: &redis::Value, cmd_name: &str) -> ExecuteResult {
    let items = match value {
        redis::Value::Array(items) => items.as_slice(),
        _ => return render_auto(value, cmd_name),
    };

    let pairs: &[redis::Value] = if cmd_name == "HSCAN" && items.len() == 2 {
        if let redis::Value::Array(inner) = &items[1] {
            inner.as_slice()
        } else {
            items
        }
    } else {
        items
    };

    let mut rows = Vec::with_capacity(pairs.len() / 2);
    for pair in pairs.chunks(2) {
        let field = redis_value_to_json(&pair[0]);
        let val = if pair.len() > 1 {
            redis_value_to_json(&pair[1])
        } else {
            serde_json::Value::Null
        };
        rows.push(vec![field, val]);
    }
    let row_count = rows.len() as u64;

    ExecuteResult::Tabular {
        columns: vec![
            ColumnInfo {
                name: "field".to_string(),
                type_name: "STRING".to_string(),
            },
            ColumnInfo {
                name: "value".to_string(),
                type_name: "STRING".to_string(),
            },
        ],
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_indexed(value: &redis::Value) -> ExecuteResult {
    match value {
        redis::Value::Array(items) => {
            let rows: Vec<Vec<serde_json::Value>> = items
                .iter()
                .enumerate()
                .map(|(i, item)| {
                    vec![
                        serde_json::Value::Number((i as i64).into()),
                        redis_value_to_json(item),
                    ]
                })
                .collect();
            let row_count = rows.len() as u64;
            ExecuteResult::Tabular {
                columns: vec![
                    ColumnInfo {
                        name: "index".to_string(),
                        type_name: "INTEGER".to_string(),
                    },
                    ColumnInfo {
                        name: "value".to_string(),
                        type_name: "STRING".to_string(),
                    },
                ],
                rows,
                row_count,
                execution_time_ms: 0,
                is_truncated: false,
            }
        }
        _ => render_auto(value, "LRANGE"),
    }
}

fn render_member(value: &redis::Value) -> ExecuteResult {
    match value {
        redis::Value::Array(items) => {
            let rows: Vec<Vec<serde_json::Value>> =
                items.iter().map(|i| vec![redis_value_to_json(i)]).collect();
            let row_count = rows.len() as u64;
            ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "member".to_string(),
                    type_name: "STRING".to_string(),
                }],
                rows,
                row_count,
                execution_time_ms: 0,
                is_truncated: false,
            }
        }
        _ => render_auto(value, "SMEMBERS"),
    }
}

fn render_member_score(value: &redis::Value) -> ExecuteResult {
    let items = match value {
        redis::Value::Array(items) => items.as_slice(),
        _ => return render_auto(value, "ZRANGE"),
    };

    let mut rows = Vec::with_capacity(items.len() / 2);
    for pair in items.chunks(2) {
        let member = redis_value_to_json(&pair[0]);
        let score = if pair.len() > 1 {
            let raw = redis_value_to_string_raw(&pair[1]);
            raw.parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::String(raw))
        } else {
            serde_json::Value::Null
        };
        rows.push(vec![member, score]);
    }
    let row_count = rows.len() as u64;

    ExecuteResult::Tabular {
        columns: vec![
            ColumnInfo {
                name: "member".to_string(),
                type_name: "STRING".to_string(),
            },
            ColumnInfo {
                name: "score".to_string(),
                type_name: "NUMERIC".to_string(),
            },
        ],
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_stream(value: &redis::Value) -> ExecuteResult {
    let entries = match value {
        redis::Value::Array(items) => items.as_slice(),
        _ => return render_auto(value, "XRANGE"),
    };

    let mut rows = Vec::with_capacity(entries.len());
    for entry in entries {
        if let redis::Value::Array(pair) = entry {
            if pair.len() >= 2 {
                let id = redis_value_to_string_raw(&pair[0]);
                let fields_value = &pair[1];
                let fields_json = match fields_value {
                    redis::Value::Array(field_items) => {
                        let mut obj = serde_json::Map::new();
                        for fp in field_items.chunks(2) {
                            if fp.len() < 2 {
                                continue;
                            }
                            let k = redis_value_to_string_raw(&fp[0]);
                            let v = redis_value_to_json(&fp[1]);
                            obj.insert(k, v);
                        }
                        serde_json::Value::Object(obj)
                    }
                    other => redis_value_to_json(other),
                };
                rows.push(vec![serde_json::Value::String(id), fields_json]);
            }
        }
    }
    let row_count = rows.len() as u64;

    ExecuteResult::Tabular {
        columns: vec![
            ColumnInfo {
                name: "id".to_string(),
                type_name: "STREAM_ID".to_string(),
            },
            ColumnInfo {
                name: "fields".to_string(),
                type_name: "JSON".to_string(),
            },
        ],
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_info(value: &redis::Value) -> ExecuteResult {
    let text = match value {
        redis::Value::BulkString(bytes) => String::from_utf8_lossy(bytes).to_string(),
        redis::Value::SimpleString(s) => s.clone(),
        _ => return render_auto(value, "INFO"),
    };

    let mut section = String::from("default");
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix('#') {
            section = rest.trim().to_string();
            continue;
        }
        if let Some(idx) = trimmed.find(':') {
            let key = trimmed[..idx].to_string();
            let val = trimmed[idx + 1..].to_string();
            rows.push(vec![
                serde_json::Value::String(section.clone()),
                serde_json::Value::String(key),
                serde_json::Value::String(val),
            ]);
        }
    }
    let row_count = rows.len() as u64;

    ExecuteResult::Tabular {
        columns: vec![
            ColumnInfo {
                name: "section".to_string(),
                type_name: "STRING".to_string(),
            },
            ColumnInfo {
                name: "key".to_string(),
                type_name: "STRING".to_string(),
            },
            ColumnInfo {
                name: "value".to_string(),
                type_name: "STRING".to_string(),
            },
        ],
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_scan(value: &redis::Value) -> ExecuteResult {
    let items = match value {
        redis::Value::Array(items) if items.len() == 2 => items,
        _ => return render_auto(value, "SCAN"),
    };
    let cursor = redis_value_to_string_raw(&items[0]);
    let keys = match &items[1] {
        redis::Value::Array(k) => k,
        _ => return render_auto(value, "SCAN"),
    };

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::with_capacity(keys.len() + 1);
    rows.push(vec![
        serde_json::Value::String("__cursor__".to_string()),
        serde_json::Value::String(cursor),
    ]);
    for k in keys {
        rows.push(vec![
            serde_json::Value::String("key".to_string()),
            redis_value_to_json(k),
        ]);
    }
    let row_count = rows.len() as u64;

    ExecuteResult::Tabular {
        columns: vec![
            ColumnInfo {
                name: "kind".to_string(),
                type_name: "STRING".to_string(),
            },
            ColumnInfo {
                name: "value".to_string(),
                type_name: "STRING".to_string(),
            },
        ],
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn render_client_list(value: &redis::Value) -> ExecuteResult {
    let text = match value {
        redis::Value::BulkString(bytes) => String::from_utf8_lossy(bytes).to_string(),
        redis::Value::SimpleString(s) => s.clone(),
        _ => return render_auto(value, "CLIENT"),
    };

    let mut headers: Vec<String> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut row_map: std::collections::BTreeMap<String, String> =
            std::collections::BTreeMap::new();
        for kv in trimmed.split_whitespace() {
            if let Some(idx) = kv.find('=') {
                let k = kv[..idx].to_string();
                let v = kv[idx + 1..].to_string();
                if !headers.iter().any(|h| h == &k) {
                    headers.push(k.clone());
                }
                row_map.insert(k, v);
            }
        }
        let row = headers
            .iter()
            .map(|h| {
                row_map
                    .get(h)
                    .cloned()
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null)
            })
            .collect();
        rows.push(row);
    }

    let row_count = rows.len() as u64;
    ExecuteResult::Tabular {
        columns: headers
            .into_iter()
            .map(|name| ColumnInfo {
                name,
                type_name: "STRING".to_string(),
            })
            .collect(),
        rows,
        row_count,
        execution_time_ms: 0,
        is_truncated: false,
    }
}

fn maybe_parse_json(s: &str) -> serde_json::Value {
    let trimmed = s.trim();
    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
            return v;
        }
    }
    serde_json::Value::String(s.to_string())
}

fn redis_value_to_string_raw(value: &redis::Value) -> String {
    match value {
        redis::Value::Nil => String::new(),
        redis::Value::Int(n) => n.to_string(),
        redis::Value::BulkString(bytes) => String::from_utf8_lossy(bytes).to_string(),
        redis::Value::SimpleString(s) => s.clone(),
        redis::Value::Okay => "OK".to_string(),
        _ => format!("{value:?}"),
    }
}

fn redis_value_to_json(value: &redis::Value) -> serde_json::Value {
    match value {
        redis::Value::Nil => serde_json::Value::Null,
        redis::Value::Int(n) => serde_json::Value::Number((*n).into()),
        redis::Value::BulkString(bytes) => {
            let s = String::from_utf8_lossy(bytes).to_string();
            serde_json::Value::String(s)
        }
        redis::Value::SimpleString(s) => serde_json::Value::String(s.clone()),
        redis::Value::Okay => serde_json::Value::String("OK".to_string()),
        redis::Value::Array(items) => {
            serde_json::Value::Array(items.iter().map(redis_value_to_json).collect())
        }
        _ => serde_json::Value::String(format!("{value:?}")),
    }
}

#[cfg(test)]
mod execute_tests {
    use super::*;

    #[test]
    fn parse_simple_args() {
        let r = parse_redis_args("GET foo").unwrap();
        assert_eq!(r, vec!["GET", "foo"]);
    }

    #[test]
    fn parse_quoted_args() {
        let r = parse_redis_args(r#"SET greeting "hello world""#).unwrap();
        assert_eq!(r, vec!["SET", "greeting", "hello world"]);
    }

    #[test]
    fn parse_single_quotes() {
        let r = parse_redis_args("SET k 'v with spaces'").unwrap();
        assert_eq!(r, vec!["SET", "k", "v with spaces"]);
    }

    #[test]
    fn parse_unterminated_quote() {
        let err = parse_redis_args(r#"SET k "unterminated"#).unwrap_err();
        assert!(err.message.contains("Unterminated"));
    }

    #[test]
    fn render_hgetall_as_field_value() {
        let value = redis::Value::Array(vec![
            redis::Value::BulkString(b"name".to_vec()),
            redis::Value::BulkString(b"Ada".to_vec()),
            redis::Value::BulkString(b"role".to_vec()),
            redis::Value::BulkString(b"admin".to_vec()),
        ]);
        let result = render_redis_value(&value, "HGETALL", &["HGETALL", "user:1"]);
        match result {
            ExecuteResult::Tabular {
                columns,
                rows,
                row_count,
                ..
            } => {
                assert_eq!(columns.len(), 2);
                assert_eq!(columns[0].name, "field");
                assert_eq!(columns[1].name, "value");
                assert_eq!(row_count, 2);
                assert_eq!(rows[0][0], serde_json::Value::String("name".into()));
                assert_eq!(rows[0][1], serde_json::Value::String("Ada".into()));
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn render_zrange_withscores() {
        let value = redis::Value::Array(vec![
            redis::Value::BulkString(b"alice".to_vec()),
            redis::Value::BulkString(b"10".to_vec()),
            redis::Value::BulkString(b"bob".to_vec()),
            redis::Value::BulkString(b"20.5".to_vec()),
        ]);
        let result =
            render_redis_value(&value, "ZRANGE", &["ZRANGE", "lb", "0", "-1", "WITHSCORES"]);
        match result {
            ExecuteResult::Tabular { columns, rows, .. } => {
                assert_eq!(columns.len(), 2);
                assert_eq!(columns[0].name, "member");
                assert_eq!(columns[1].name, "score");
                assert_eq!(columns[1].type_name, "NUMERIC");
                assert!(matches!(rows[0][1], serde_json::Value::Number(_)));
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn render_lrange_indexed() {
        let value = redis::Value::Array(vec![
            redis::Value::BulkString(b"first".to_vec()),
            redis::Value::BulkString(b"second".to_vec()),
        ]);
        let result = render_redis_value(&value, "LRANGE", &["LRANGE", "q", "0", "-1"]);
        match result {
            ExecuteResult::Tabular { columns, rows, .. } => {
                assert_eq!(columns[0].name, "index");
                assert_eq!(rows[0][0], serde_json::Value::Number(0.into()));
                assert_eq!(rows[1][0], serde_json::Value::Number(1.into()));
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn render_stream_entries() {
        let value = redis::Value::Array(vec![redis::Value::Array(vec![
            redis::Value::BulkString(b"1700000000000-0".to_vec()),
            redis::Value::Array(vec![
                redis::Value::BulkString(b"event".to_vec()),
                redis::Value::BulkString(b"login".to_vec()),
            ]),
        ])]);
        let result = render_redis_value(&value, "XRANGE", &["XRANGE", "events", "-", "+"]);
        match result {
            ExecuteResult::Tabular { columns, rows, .. } => {
                assert_eq!(columns[0].name, "id");
                assert_eq!(columns[1].name, "fields");
                assert_eq!(rows.len(), 1);
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn render_get_parses_json() {
        let value = redis::Value::BulkString(br#"{"a":1,"b":"x"}"#.to_vec());
        let result = render_redis_value(&value, "GET", &["GET", "k"]);
        match result {
            ExecuteResult::Tabular { rows, .. } => {
                assert!(matches!(rows[0][0], serde_json::Value::Object(_)));
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn render_get_preserves_plain_string() {
        let value = redis::Value::BulkString(b"hello".to_vec());
        let result = render_redis_value(&value, "GET", &["GET", "k"]);
        match result {
            ExecuteResult::Tabular { rows, .. } => {
                assert_eq!(rows[0][0], serde_json::Value::String("hello".into()));
            }
            _ => panic!("expected tabular"),
        }
    }

    #[test]
    fn friendly_error_detects_wrongtype() {
        let err = redis::RedisError::from((
            redis::ErrorKind::TypeError,
            "WRONGTYPE Operation against a key holding the wrong kind of value",
        ));
        let e = friendly_redis_error(&err, "HGETALL");
        assert_eq!(e.code, "REDIS_WRONG_TYPE");
        assert!(e.message.contains("HGETALL"));
    }
}
