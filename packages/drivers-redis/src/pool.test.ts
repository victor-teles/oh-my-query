import type Redis from "ioredis";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import {
  deleteRedisKey,
  isRedisPool,
  mapRedisError,
  parseRedisCommands,
  redisDbInfo,
  RedisPool,
  scanRedisKeys,
} from "./pool.ts";

interface PipelineCall {
  cmd: string;
  args: unknown[];
}

interface FakePipeline {
  calls: PipelineCall[];
  results: [Error | null, unknown][];
  exec: ReturnType<typeof vi.fn>;
  set: (results: [Error | null, unknown][]) => void;
  add: (cmd: string, ...args: unknown[]) => FakePipeline;
}

const buildPipeline = (): FakePipeline => {
  const calls: PipelineCall[] = [];
  let results: [Error | null, unknown][] = [];
  const pipe: FakePipeline = {
    add(cmd, ...args) {
      calls.push({ args, cmd });
      return pipe;
    },
    calls,
    exec: vi.fn(async () => {
      await Promise.resolve();
      return results;
    }),
    get results() {
      return results;
    },
    set(next) {
      results = next;
    },
  };
  const proxy = new Proxy(pipe, {
    get(target, prop) {
      if (prop in target) {
        return Reflect.get(target, prop);
      }
      return (...args: unknown[]) => target.add(String(prop), ...args);
    },
  });
  return proxy;
};

interface FakeClient {
  ping: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  config: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  dbsize: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  call: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
  pendingPipelines: FakePipeline[];
}

const buildFakeClient = (): FakeClient => {
  const pendingPipelines: FakePipeline[] = [];
  return {
    call: vi.fn(),
    config: vi.fn(),
    dbsize: vi.fn(),
    del: vi.fn(),
    disconnect: vi.fn(),
    info: vi.fn(),
    pendingPipelines,
    ping: vi.fn(async () => {
      await Promise.resolve();
      return "PONG";
    }),
    pipeline: vi.fn(() => {
      const pipe = buildPipeline();
      pendingPipelines.push(pipe);
      return pipe;
    }),
    quit: vi.fn(async () => {
      await Promise.resolve();
      return "OK";
    }),
    scan: vi.fn(),
    select: vi.fn(async () => {
      await Promise.resolve();
      return "OK";
    }),
  };
};

const buildPool = (): { client: FakeClient; pool: RedisPool } => {
  const client = buildFakeClient();
  const pool = new RedisPool(client as unknown as Redis, 0);
  return { client, pool };
};

describe("isRedisPool", () => {
  it("returns true for a RedisPool instance", () => {
    const { pool } = buildPool();
    expect(isRedisPool(pool)).toBeTruthy();
  });

  it("returns false for a plain object", () => {
    expect(isRedisPool({} as unknown as RedisPool)).toBeFalsy();
  });
});

describe("redisPool > metadata", () => {
  it("fetchVersion parses redis_version from INFO server and prefixes with 'Redis'", async () => {
    const { client, pool } = buildPool();
    client.info.mockResolvedValue(
      "# Server\r\nredis_version:7.2.4\r\nredis_mode:standalone\r\n"
    );
    await expect(pool.fetchVersion()).resolves.toBe("Redis 7.2.4");
    expect(client.info).toHaveBeenCalledWith("server");
  });

  it("fetchVersion returns empty string when version is missing", async () => {
    const { client, pool } = buildPool();
    client.info.mockResolvedValue("# Server\r\nredis_mode:standalone\r\n");
    await expect(pool.fetchVersion()).resolves.toBe("");
  });

  it("fetchVersion wraps native errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.info.mockRejectedValue(new Error("connection lost"));
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("connection lost");
  });

  it("listDatabases returns indices 0..N-1 from CONFIG GET databases", async () => {
    const { client, pool } = buildPool();
    client.config.mockResolvedValue(["databases", "16"]);
    await expect(pool.listDatabases()).resolves.toStrictEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
    ]);
    expect(client.config).toHaveBeenCalledWith("GET", "databases");
  });

  it("listDatabases returns ['0'..'9'] when count is 10", async () => {
    const { client, pool } = buildPool();
    client.config.mockResolvedValue(["databases", "10"]);
    await expect(pool.listDatabases()).resolves.toStrictEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
  });

  it("listDatabases falls back to ['0'] when CONFIG fails (managed Redis)", async () => {
    const { client, pool } = buildPool();
    client.config.mockRejectedValue(
      new Error("ERR unknown command 'CONFIG' (managed)")
    );
    await expect(pool.listDatabases()).resolves.toStrictEqual(["0"]);
  });

  it("listDatabases falls back to ['0'] when count is non-numeric", async () => {
    const { client, pool } = buildPool();
    client.config.mockResolvedValue(["databases", "nope"]);
    await expect(pool.listDatabases()).resolves.toStrictEqual(["0"]);
  });
});

describe("redisPool > fetchSchema", () => {
  it("returns an empty schema using the database name and issues no commands", async () => {
    const { client, pool } = buildPool();
    const result = await pool.fetchSchema("3");
    expect(result).toStrictEqual({
      schemas: [{ name: "3", tables: [], views: [] }],
    });
    expect(client.info).not.toHaveBeenCalled();
    expect(client.config).not.toHaveBeenCalled();
    expect(client.scan).not.toHaveBeenCalled();
  });
});

describe("redisPool > execute", () => {
  it("runs a single command via client.call and returns one document", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("hello");
    const result = await pool.execute(
      "GET greeting",
      100,
      null,
      new AbortController().signal
    );
    expect(client.call).toHaveBeenCalledWith("GET", "greeting");
    expect(result).toStrictEqual({
      count: 1,
      documents: [{ command: "GET greeting", reply: "hello" }],
      executionTimeMs: 0,
      isTruncated: false,
      resultType: "documents",
    });
  });

  it("runs multi-line input as separate commands in order", async () => {
    const { client, pool } = buildPool();
    client.call
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("1")
      .mockResolvedValueOnce(2);
    const result = await pool.execute(
      "SET a 1\nGET a\nINCR counter",
      100,
      null,
      new AbortController().signal
    );
    expect(client.call.mock.calls).toStrictEqual([
      ["SET", "a", "1"],
      ["GET", "a"],
      ["INCR", "counter"],
    ]);
    expect(result).toStrictEqual({
      count: 3,
      documents: [
        { command: "SET a 1", reply: "OK" },
        { command: "GET a", reply: "1" },
        { command: "INCR counter", reply: 2 },
      ],
      executionTimeMs: 0,
      isTruncated: false,
      resultType: "documents",
    });
  });

  it("preserves quoted args containing whitespace", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("OK");
    await pool.execute(
      'SET "user:1" "John Doe"',
      100,
      null,
      new AbortController().signal
    );
    expect(client.call).toHaveBeenCalledWith("SET", "user:1", "John Doe");
  });

  it("supports escape sequences inside double quotes", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("OK");
    await pool.execute(
      'SET key "line1\\nline2"',
      100,
      null,
      new AbortController().signal
    );
    expect(client.call).toHaveBeenCalledWith("SET", "key", "line1\nline2");
  });

  it("ignores blank lines and # / // comment lines", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("hello");
    await pool.execute(
      "# header\n\n// note\nGET greeting",
      100,
      null,
      new AbortController().signal
    );
    expect(client.call).toHaveBeenCalledOnce();
    expect(client.call).toHaveBeenCalledWith("GET", "greeting");
  });

  it("rejects empty / comment-only input with INVALID_COMMAND", async () => {
    const { pool } = buildPool();
    const err = await pool
      .execute(
        "  \n# only a comment\n",
        100,
        null,
        new AbortController().signal
      )
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("INVALID_COMMAND");
  });

  it("decodes Buffer replies to UTF-8 strings", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce(Buffer.from("héllo", "utf8"));
    const result = await pool.execute(
      "GET k",
      100,
      null,
      new AbortController().signal
    );
    expect(result).toStrictEqual({
      count: 1,
      documents: [{ command: "GET k", reply: "héllo" }],
      executionTimeMs: 0,
      isTruncated: false,
      resultType: "documents",
    });
  });

  it("decodes nested Buffer replies inside arrays", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce([
      Buffer.from("a", "utf8"),
      Buffer.from("b", "utf8"),
    ]);
    const result = await pool.execute(
      "LRANGE list 0 -1",
      100,
      null,
      new AbortController().signal
    );
    expect(result).toStrictEqual({
      count: 1,
      documents: [{ command: "LRANGE list 0 -1", reply: ["a", "b"] }],
      executionTimeMs: 0,
      isTruncated: false,
      resultType: "documents",
    });
  });

  it("calls SELECT once when schema differs from defaultDb", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
    await pool.execute(
      "SET a 1\nSET b 2",
      100,
      "3",
      new AbortController().signal
    );
    expect(client.select).toHaveBeenCalledWith(3);
    expect(client.select).toHaveBeenCalledOnce();
  });

  it("does not call SELECT when schema matches defaultDb", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("OK");
    await pool.execute("SET a 1", 100, "0", new AbortController().signal);
    expect(client.select).not.toHaveBeenCalled();
  });

  it("does not call SELECT when schema is null", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValueOnce("OK");
    await pool.execute("SET a 1", 100, null, new AbortController().signal);
    expect(client.select).not.toHaveBeenCalled();
  });

  it("truncates to maxRows commands when more are provided", async () => {
    const { client, pool } = buildPool();
    client.call.mockResolvedValue("OK");
    const result = await pool.execute(
      "SET a 1\nSET b 2\nSET c 3",
      1,
      null,
      new AbortController().signal
    );
    expect(client.call).toHaveBeenCalledOnce();
    expect(result).toStrictEqual({
      count: 1,
      documents: [{ command: "SET a 1", reply: "OK" }],
      executionTimeMs: 0,
      isTruncated: true,
      resultType: "documents",
    });
  });

  it("wraps native errors from client.call in DbError", async () => {
    const { client, pool } = buildPool();
    client.call.mockRejectedValueOnce(
      new Error("ERR wrong number of arguments for 'set' command")
    );
    const err = await pool
      .execute("SET k", 100, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe(
      "ERR wrong number of arguments for 'set' command"
    );
  });

  it("aborts before issuing the next command when signal fires mid-batch", async () => {
    const { client, pool } = buildPool();
    const controller = new AbortController();
    client.call.mockImplementationOnce(async () => {
      await Promise.resolve();
      controller.abort();
      return "OK";
    });
    const err = await pool
      .execute("SET a 1\nSET b 2", 100, null, controller.signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("QUERY_CANCELLED");
    expect(client.call).toHaveBeenCalledOnce();
  });

  it("rejects with POOL_CLOSED when pool is closed", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await pool
      .execute("GET x", 100, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });
});

describe("redisPool > explain", () => {
  it("rejects with UNSUPPORTED", async () => {
    const { pool } = buildPool();
    const err = await pool
      .explain("KEYS *", false, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED");
  });
});

describe("parseRedisCommands", () => {
  it("splits on newlines and tokenizes by whitespace", () => {
    expect(parseRedisCommands("GET a\nSET b 1")).toStrictEqual([
      { args: ["a"], name: "GET", raw: "GET a" },
      { args: ["b", "1"], name: "SET", raw: "SET b 1" },
    ]);
  });

  it("treats a double-quoted string as one token", () => {
    expect(parseRedisCommands('SET "user 1" hello')).toStrictEqual([
      { args: ["user 1", "hello"], name: "SET", raw: 'SET "user 1" hello' },
    ]);
  });

  it("treats a single-quoted string as one token without escapes", () => {
    expect(parseRedisCommands("SET 'a\\nb' v")).toStrictEqual([
      { args: ["a\\nb", "v"], name: "SET", raw: "SET 'a\\nb' v" },
    ]);
  });

  it("throws INVALID_COMMAND on unterminated quotes", () => {
    expect(() => parseRedisCommands('GET "missing')).toThrow(DbError);
  });

  it("throws INVALID_COMMAND when input has no commands", () => {
    expect(() => parseRedisCommands("\n# only\n")).toThrow(DbError);
  });
});

describe("redisPool > close", () => {
  it("calls quit on the client", async () => {
    const { client, pool } = buildPool();
    await pool.close();
    expect(client.quit).toHaveBeenCalledWith();
  });

  it("makes subsequent operations fail with POOL_CLOSED", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });

  it("is idempotent — second close is a no-op", async () => {
    const { client, pool } = buildPool();
    await pool.close();
    await expect(pool.close()).resolves.toBeUndefined();
    expect(client.quit).toHaveBeenCalledOnce();
  });

  it("falls back to disconnect when quit throws", async () => {
    const { client, pool } = buildPool();
    client.quit.mockRejectedValueOnce(new Error("already closing"));
    await expect(pool.close()).resolves.toBeUndefined();
    expect(client.disconnect).toHaveBeenCalledWith();
  });
});

describe("mapRedisError", () => {
  it("returns DbError instances unchanged", () => {
    const original = new DbError("FOO", "bar");
    expect(mapRedisError(original)).toBe(original);
  });

  it("wraps a generic Error into DbError with DB_ERROR code", () => {
    const wrapped = mapRedisError(new Error("boom"));
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.code).toBe("DB_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("preserves err.code when present (e.g. NOAUTH)", () => {
    const noauth = Object.assign(new Error("NOAUTH Authentication required."), {
      code: "NOAUTH",
    });
    const wrapped = mapRedisError(noauth);
    expect(wrapped.code).toBe("NOAUTH");
    expect(wrapped.message).toBe("NOAUTH Authentication required.");
  });

  it("falls back to error name when message is missing", () => {
    const wrapped = mapRedisError({ name: "WeirdError" });
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("WeirdError");
  });

  it("stringifies non-Error values", () => {
    const wrapped = mapRedisError(42);
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("42");
  });
});

describe("redisDbInfo", () => {
  it("selects the db, runs DBSIZE and INFO memory, and returns parsed counts", async () => {
    const { client, pool } = buildPool();
    client.dbsize.mockResolvedValue(123);
    client.info.mockResolvedValue(
      "# Memory\r\nused_memory:4567\r\nused_memory_human:4.46K\r\n"
    );
    await expect(redisDbInfo(pool, 2)).resolves.toStrictEqual({
      memoryBytes: 4567,
      totalKeys: 123,
    });
    expect(client.select).toHaveBeenCalledWith(2);
    expect(client.info).toHaveBeenCalledWith("memory");
  });

  it("returns memoryBytes null when used_memory line is missing", async () => {
    const { client, pool } = buildPool();
    client.dbsize.mockResolvedValue(0);
    client.info.mockResolvedValue("# Memory\r\nused_memory_human:N/A\r\n");
    await expect(redisDbInfo(pool, 0)).resolves.toStrictEqual({
      memoryBytes: null,
      totalKeys: 0,
    });
  });

  it("wraps native errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.dbsize.mockRejectedValue(new Error("readonly"));
    const err = await redisDbInfo(pool, 0).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("readonly");
  });

  it("rejects with POOL_CLOSED when pool is closed", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await redisDbInfo(pool, 0).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });
});

describe("scanRedisKeys", () => {
  it("issues SCAN with cursor, MATCH pattern, and COUNT, then collects key metadata", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue(["42", ["greeting", "users"]]);
    const meta = buildPipeline();
    meta.set([
      [null, "string"],
      [null, -1],
      [null, "hash"],
      [null, 5000],
    ]);
    const sizes = buildPipeline();
    sizes.set([
      [null, 11],
      [null, 3],
    ]);
    client.pipeline.mockReturnValueOnce(meta).mockReturnValueOnce(sizes);

    const page = await scanRedisKeys(pool, 1, "*", "0", 200);
    expect(client.select).toHaveBeenCalledWith(1);
    expect(client.scan).toHaveBeenCalledWith("0", "MATCH", "*", "COUNT", 200);
    expect(page.nextCursor).toBe("42");
    expect(page.sampled).toBe(2);
    expect(page.keys).toStrictEqual([
      {
        kind: "STRING",
        name: "greeting",
        size: 11,
        sizeUnit: "bytes",
        ttlSecs: null,
      },
      {
        kind: "HASH",
        name: "users",
        size: 3,
        sizeUnit: "fields",
        ttlSecs: 5,
      },
    ]);
  });

  it("uses '*' as the default pattern when null", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue(["0", []]);
    await scanRedisKeys(pool, 0, null, "0", null);
    expect(client.scan).toHaveBeenCalledWith("0", "MATCH", "*");
  });

  it("omits COUNT when null", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue(["0", []]);
    await scanRedisKeys(pool, 0, "user:*", "0", null);
    expect(client.scan).toHaveBeenCalledWith("0", "MATCH", "user:*");
  });

  it("maps each Redis type to the right size command and unit", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue([
      "0",
      ["s", "h", "l", "set", "zset", "stream", "weird"],
    ]);
    const meta = buildPipeline();
    meta.set([
      [null, "string"],
      [null, -1],
      [null, "hash"],
      [null, -1],
      [null, "list"],
      [null, -1],
      [null, "set"],
      [null, -1],
      [null, "zset"],
      [null, -1],
      [null, "stream"],
      [null, -1],
      [null, "none"],
      [null, -1],
    ]);
    const sizes = buildPipeline();
    sizes.set([
      [null, 4],
      [null, 1],
      [null, 2],
      [null, 3],
      [null, 5],
      [null, 6],
    ]);
    client.pipeline.mockReturnValueOnce(meta).mockReturnValueOnce(sizes);

    const page = await scanRedisKeys(pool, 0, null, "0", null);
    expect(
      page.keys.map((k) => [k.name, k.kind, k.size, k.sizeUnit])
    ).toStrictEqual([
      ["s", "STRING", 4, "bytes"],
      ["h", "HASH", 1, "fields"],
      ["l", "LIST", 2, "items"],
      ["set", "SET", 3, "members"],
      ["zset", "ZSET", 5, "members"],
      ["stream", "STREAM", 6, "entries"],
      ["weird", "UNKNOWN", null, ""],
    ]);
    const sizeCommands = sizes.calls.map((c) => c.cmd);
    expect(sizeCommands).toStrictEqual([
      "strlen",
      "hlen",
      "llen",
      "scard",
      "zcard",
      "xlen",
    ]);
  });

  it("converts PTTL milliseconds to seconds and treats -1/-2 as no expiry", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue(["0", ["a", "b", "c"]]);
    const meta = buildPipeline();
    meta.set([
      [null, "string"],
      [null, 12_345],
      [null, "string"],
      [null, -1],
      [null, "string"],
      [null, -2],
    ]);
    const sizes = buildPipeline();
    sizes.set([
      [null, 1],
      [null, 1],
      [null, 1],
    ]);
    client.pipeline.mockReturnValueOnce(meta).mockReturnValueOnce(sizes);

    const page = await scanRedisKeys(pool, 0, null, "0", null);
    expect(page.keys.map((k) => k.ttlSecs)).toStrictEqual([12, null, null]);
  });

  it("returns an empty page when SCAN yields no keys (skips the metadata pipelines)", async () => {
    const { client, pool } = buildPool();
    client.scan.mockResolvedValue(["0", []]);
    const page = await scanRedisKeys(pool, 0, null, "0", null);
    expect(page).toStrictEqual({ keys: [], nextCursor: "0", sampled: 0 });
    expect(client.pipeline).not.toHaveBeenCalled();
  });

  it("wraps native errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.scan.mockRejectedValue(new Error("scan failed"));
    const err = await scanRedisKeys(pool, 0, null, "0", null).catch(
      (error: unknown) => error
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("scan failed");
  });

  it("rejects with POOL_CLOSED when pool is closed", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await scanRedisKeys(pool, 0, null, "0", null).catch(
      (error: unknown) => error
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });
});

describe("deleteRedisKey", () => {
  it("selects the db, runs DEL, and returns the count", async () => {
    const { client, pool } = buildPool();
    client.del.mockResolvedValue(1);
    await expect(deleteRedisKey(pool, 4, "greeting")).resolves.toBe(1);
    expect(client.select).toHaveBeenCalledWith(4);
    expect(client.del).toHaveBeenCalledWith("greeting");
  });

  it("returns 0 when the key did not exist", async () => {
    const { client, pool } = buildPool();
    client.del.mockResolvedValue(0);
    await expect(deleteRedisKey(pool, 0, "missing")).resolves.toBe(0);
  });

  it("wraps native errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.del.mockRejectedValue(new Error("permission denied"));
    const err = await deleteRedisKey(pool, 0, "k").catch(
      (error: unknown) => error
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("permission denied");
  });

  it("rejects with POOL_CLOSED when pool is closed", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await deleteRedisKey(pool, 0, "k").catch(
      (error: unknown) => error
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });
});
