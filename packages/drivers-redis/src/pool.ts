import type {
  DocumentResult,
  ExecuteResult,
  ExplainResult,
  Pool,
  RedisDbInfo,
  RedisKey,
  RedisKeyKind,
  RedisScanPage,
  RedisSizeUnit,
  SchemaInfo,
} from "@oh-my-query/core";
import type { ChainableCommander, Redis } from "ioredis";

import { DbError } from "@oh-my-query/core";

interface SizeCommand {
  method: keyof Pick<
    ChainableCommander,
    "strlen" | "hlen" | "llen" | "scard" | "zcard" | "xlen"
  >;
  unit: RedisSizeUnit;
}

const SIZE_COMMAND_BY_KIND: Partial<Record<RedisKeyKind, SizeCommand>> = {
  HASH: { method: "hlen", unit: "fields" },
  LIST: { method: "llen", unit: "items" },
  SET: { method: "scard", unit: "members" },
  STREAM: { method: "xlen", unit: "entries" },
  STRING: { method: "strlen", unit: "bytes" },
  ZSET: { method: "zcard", unit: "members" },
};

const KIND_BY_REPLY: Record<string, RedisKeyKind> = {
  hash: "HASH",
  list: "LIST",
  set: "SET",
  stream: "STREAM",
  string: "STRING",
  zset: "ZSET",
};

function mapKind(reply: unknown): RedisKeyKind {
  return typeof reply === "string"
    ? (KIND_BY_REPLY[reply.toLowerCase()] ?? "UNKNOWN")
    : "UNKNOWN";
}

function mapTtlSecs(pttl: unknown): number | null {
  if (typeof pttl !== "number" || !Number.isFinite(pttl) || pttl < 0) {
    return null;
  }
  return Math.floor(pttl / 1000);
}

function parseInfoNumber(info: string, key: string): number | null {
  const re = new RegExp(`^${key}:([0-9]+)\\s*$`, "m");
  const match = re.exec(info);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRedisVersion(info: string): string | null {
  const match = /^redis_version:(.+)\s*$/m.exec(info);
  return match?.[1]?.trim() ?? null;
}

export function mapRedisError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  const e = err as { code?: string; message?: string; name?: string };
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    "Redis error";
  return new DbError(e.code ?? "DB_ERROR", message);
}

const POOL_CLOSED = new DbError("POOL_CLOSED", "Redis pool is closed");

export function parseDbIndex(database: string | undefined | null): number {
  const trimmed = database?.trim();
  if (!trimmed) {
    return 0;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export interface RedisCommand {
  name: string;
  args: string[];
  raw: string;
}

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  "'": "'",
  "\\": "\\",
  n: "\n",
  r: "\r",
  t: "\t",
};

function tokenizeLine(line: string, lineNumber: number): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i] ?? "";
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = "";
      i += 1;
      while (i < line.length) {
        const c = line[i] ?? "";
        if (c === "\\" && quote === '"') {
          const next = line[i + 1];
          if (next !== undefined && next in ESCAPE_MAP) {
            value += ESCAPE_MAP[next];
            i += 2;
            continue;
          }
        }
        if (c === quote) {
          i += 1;
          tokens.push(value);
          break;
        }
        value += c;
        i += 1;
        if (i >= line.length) {
          throw new DbError(
            "INVALID_COMMAND",
            `Unterminated ${quote === '"' ? "double" : "single"}-quoted string on line ${lineNumber}`
          );
        }
      }
      continue;
    }
    let value = "";
    while (i < line.length) {
      const c = line[i] ?? "";
      if (c === " " || c === "\t") {
        break;
      }
      value += c;
      i += 1;
    }
    tokens.push(value);
  }
  return tokens;
}

export function parseRedisCommands(input: string): RedisCommand[] {
  const commands: RedisCommand[] = [];
  const lines = input.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const raw = lines[idx] ?? "";
    const trimmed = raw.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("//")
    ) {
      continue;
    }
    const tokens = tokenizeLine(raw, idx + 1);
    const [name, ...args] = tokens;
    if (!name) {
      continue;
    }
    commands.push({ args, name, raw: trimmed });
  }
  if (commands.length === 0) {
    throw new DbError("INVALID_COMMAND", "No Redis command to run");
  }
  return commands;
}

function decodeReply(reply: unknown): unknown {
  if (reply === null || reply === undefined) {
    return null;
  }
  if (typeof reply === "string" || typeof reply === "number") {
    return reply;
  }
  if (Buffer.isBuffer(reply)) {
    return reply.toString("utf8");
  }
  if (Array.isArray(reply)) {
    return reply.map(decodeReply);
  }
  if (typeof reply === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      reply as Record<string, unknown>
    )) {
      out[key] = decodeReply(value);
    }
    return out;
  }
  return String(reply);
}

export class RedisPool implements Pool {
  readonly dialect = null;
  readonly supportsExplain = false;
  readonly kind = "redis" as const;
  #client: Redis | null;
  readonly #defaultDb: number;

  constructor(client: Redis, defaultDb: number) {
    this.#client = client;
    this.#defaultDb = defaultDb;
  }

  get client(): Redis | null {
    return this.#client;
  }

  get defaultDb(): number {
    return this.#defaultDb;
  }

  async fetchVersion(): Promise<string> {
    const client = this.#requireClient();
    try {
      const info = await client.info("server");
      const version = parseRedisVersion(info);
      return version ? `Redis ${version}` : "";
    } catch (error) {
      throw mapRedisError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    const client = this.#requireClient();
    let count = 1;
    try {
      const reply = (await client.config("GET", "databases")) as
        | string[]
        | undefined;
      const raw = reply?.[1];
      const parsed = Number.parseInt(raw ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        count = parsed;
      }
    } catch {
      // CONFIG is denied on managed Redis — fall back to a single db.
    }
    return Array.from({ length: count }, (_, i) => i.toString());
  }

  fetchSchema(db: string): Promise<SchemaInfo> {
    if (!this.#client) {
      return Promise.reject(POOL_CLOSED);
    }
    return Promise.resolve({
      schemas: [{ name: db, tables: [], views: [] }],
    });
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    const client = this.#requireClient();
    const commands = parseRedisCommands(sql);
    const targetDb = parseDbIndex(schema);
    const limit = Math.max(1, maxRows);
    const isTruncated = commands.length > limit;
    const toRun = isTruncated ? commands.slice(0, limit) : commands;
    const documents: unknown[] = [];
    try {
      if (schema && targetDb !== this.#defaultDb) {
        await client.select(targetDb);
      }
      for (const command of toRun) {
        if (signal.aborted) {
          throw new DbError("QUERY_CANCELLED", "Query cancelled");
        }
        const reply = await client.call(command.name, ...command.args);
        documents.push({
          command: command.raw,
          reply: decodeReply(reply),
        });
      }
    } catch (error) {
      throw mapRedisError(error);
    }
    const result: DocumentResult = {
      count: documents.length,
      documents,
      executionTimeMs: 0,
      isTruncated,
      resultType: "documents",
    };
    return result;
  }

  explain(
    _sql: string,
    _analyze: boolean,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExplainResult> {
    return Promise.reject(
      new DbError("UNSUPPORTED", `${this.kind} does not support EXPLAIN`)
    );
  }

  async close(): Promise<void> {
    const client = this.#client;
    if (!client) {
      return;
    }
    this.#client = null;
    try {
      await client.quit();
    } catch {
      try {
        client.disconnect();
      } catch {
        // already disconnected
      }
    }
  }

  #requireClient(): Redis {
    if (!this.#client) {
      throw POOL_CLOSED;
    }
    return this.#client;
  }
}

export function isRedisPool(pool: unknown): pool is RedisPool {
  return pool instanceof RedisPool;
}

function requireClient(pool: RedisPool): Redis {
  const { client } = pool;
  if (!client) {
    throw POOL_CLOSED;
  }
  return client;
}

export async function redisDbInfo(
  pool: RedisPool,
  dbIndex: number
): Promise<RedisDbInfo> {
  const client = requireClient(pool);
  try {
    await client.select(dbIndex);
    const totalKeys = await client.dbsize();
    const memoryInfo = await client.info("memory");
    const memoryBytes = parseInfoNumber(memoryInfo, "used_memory");
    return { memoryBytes, totalKeys };
  } catch (error) {
    throw mapRedisError(error);
  }
}

function runScan(
  client: Redis,
  cursor: string,
  match: string,
  count: number | null
): Promise<[string, string[]]> {
  if (count === null) {
    return client.scan(cursor, "MATCH", match);
  }
  return client.scan(cursor, "MATCH", match, "COUNT", count);
}

async function fetchKindsAndTtls(
  client: Redis,
  keys: string[]
): Promise<{ kinds: RedisKeyKind[]; ttls: (number | null)[] }> {
  const meta = client.pipeline();
  for (const name of keys) {
    meta.type(name);
    meta.pttl(name);
  }
  const results = (await meta.exec()) ?? [];
  const kinds: RedisKeyKind[] = [];
  const ttls: (number | null)[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    kinds.push(mapKind(results[i * 2]?.[1]));
    ttls.push(mapTtlSecs(results[i * 2 + 1]?.[1]));
  }
  return { kinds, ttls };
}

interface SizeOp {
  idx: number;
  unit: RedisSizeUnit;
}

function queueSizeCommands(
  pipeline: ChainableCommander,
  keys: string[],
  kinds: RedisKeyKind[]
): SizeOp[] {
  const ops: SizeOp[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const cmd = SIZE_COMMAND_BY_KIND[kinds[i] ?? "UNKNOWN"];
    const name = keys[i];
    if (cmd && name !== undefined) {
      pipeline[cmd.method](name);
      ops.push({ idx: i, unit: cmd.unit });
    }
  }
  return ops;
}

async function fetchSizes(
  client: Redis,
  keys: string[],
  kinds: RedisKeyKind[]
): Promise<Map<number, { size: number; unit: RedisSizeUnit }>> {
  const out = new Map<number, { size: number; unit: RedisSizeUnit }>();
  const pipeline = client.pipeline();
  const ops = queueSizeCommands(pipeline, keys, kinds);
  if (ops.length === 0) {
    return out;
  }
  const results = (await pipeline.exec()) ?? [];
  for (let j = 0; j < ops.length; j += 1) {
    const op = ops[j];
    const reply = results[j]?.[1];
    if (op && typeof reply === "number" && Number.isFinite(reply)) {
      out.set(op.idx, { size: reply, unit: op.unit });
    }
  }
  return out;
}

export async function scanRedisKeys(
  pool: RedisPool,
  dbIndex: number,
  pattern: string | null,
  cursor: string,
  count: number | null
): Promise<RedisScanPage> {
  const client = requireClient(pool);
  try {
    await client.select(dbIndex);
    const [nextCursor, keys] = await runScan(
      client,
      cursor,
      pattern ?? "*",
      count
    );
    if (keys.length === 0) {
      return { keys: [], nextCursor, sampled: 0 };
    }

    const { kinds, ttls } = await fetchKindsAndTtls(client, keys);
    const sizes = await fetchSizes(client, keys, kinds);

    const out: RedisKey[] = keys.map((name, i) => {
      const info = sizes.get(i);
      return {
        kind: kinds[i] ?? "UNKNOWN",
        name,
        size: info?.size ?? null,
        sizeUnit: info?.unit ?? "",
        ttlSecs: ttls[i] ?? null,
      };
    });

    return { keys: out, nextCursor, sampled: keys.length };
  } catch (error) {
    throw mapRedisError(error);
  }
}

export async function deleteRedisKey(
  pool: RedisPool,
  dbIndex: number,
  name: string
): Promise<number> {
  const client = requireClient(pool);
  try {
    await client.select(dbIndex);
    return await client.del(name);
  } catch (error) {
    throw mapRedisError(error);
  }
}
