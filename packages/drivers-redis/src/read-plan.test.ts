import { DbError } from "@oh-my-query/core";
import Redis from "ioredis";
import { afterAll, describe, expect, it } from "vitest";

import { fakeRedis, replyTable as replies } from "./fake-redis.ts";
import { RedisPool } from "./pool.ts";
import { parseInfo, runRedisReadPlan } from "./read-plan.ts";
import { toCell } from "./scan.ts";

const signal = () => new AbortController().signal;
const commands = (...list: unknown[][]) =>
  JSON.stringify({ commands: list, kind: "commands" });
const scan = (plan: Record<string, unknown>) =>
  JSON.stringify({ groupBy: "pattern", kind: "scan", limit: 10, ...plan });

describe("runRedisReadPlan", () => {
  it("runs on a duplicated client for the database and always quits it", async () => {
    const fake = fakeRedis({ reply: replies({ "GET greeting": "hello" }) });
    const result = await runRedisReadPlan(
      fake.pool,
      commands(["GET", "greeting"]),
      "3",
      2000,
      signal()
    );
    expect(fake.duplicate).toHaveBeenCalledWith({ db: 3, lazyConnect: true });
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.select).not.toHaveBeenCalled();
    expect(fake.quit).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      columns: [
        { name: "command", typeName: "TEXT" },
        { name: "key", typeName: "TEXT" },
        { name: "value", typeName: "TEXT" },
      ],
      rows: [["GET", "greeting", "hello"]],
    });
  });

  it("quits the duplicate even when a command fails", async () => {
    const fake = fakeRedis({
      reply: () => {
        throw new Error("WRONGTYPE Operation against a key");
      },
    });
    fake.call.mockRejectedValueOnce(new Error("WRONGTYPE"));
    await expect(
      runRedisReadPlan(fake.pool, commands(["GET", "x"]), "0", 10, signal())
    ).rejects.toBeInstanceOf(DbError);
    expect(fake.quit).toHaveBeenCalledOnce();
  });

  it("disconnects when quit fails", async () => {
    const fake = fakeRedis();
    fake.quit.mockRejectedValueOnce(new Error("closed"));
    await runRedisReadPlan(fake.pool, commands(["DBSIZE"]), "0", 10, signal());
    expect(fake.disconnect).toHaveBeenCalledOnce();
  });

  it("refuses a write before opening a connection", async () => {
    const fake = fakeRedis();
    await expect(
      runRedisReadPlan(
        fake.pool,
        commands(["SET", "k", "v"]),
        "0",
        10,
        signal()
      )
    ).rejects.toMatchObject({
      code: "NOT_READ_ONLY",
      message: "SET writes data; only read commands can run here.",
    });
    expect(fake.duplicate).not.toHaveBeenCalled();
  });

  it("stops and disconnects when the signal aborts", async () => {
    const controller = new AbortController();
    const fake = fakeRedis();
    fake.call.mockImplementation(() => {
      controller.abort();
      return Promise.resolve(1);
    });
    await expect(
      runRedisReadPlan(
        fake.pool,
        commands(["GET", "a"], ["GET", "b"]),
        "0",
        10,
        controller.signal
      )
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(fake.disconnect).toHaveBeenCalledWith();
    expect(fake.call).toHaveBeenCalledOnce();
  });

  it("rejects an already aborted ask without connecting", async () => {
    const fake = fakeRedis();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runRedisReadPlan(
        fake.pool,
        commands(["DBSIZE"]),
        "0",
        10,
        controller.signal
      )
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(fake.duplicate).not.toHaveBeenCalled();
  });

  it("fails cleanly on a closed pool", async () => {
    const pool = new RedisPool(null as unknown as Redis, 0);
    await expect(
      runRedisReadPlan(pool, commands(["DBSIZE"]), "0", 10, signal())
    ).rejects.toMatchObject({ code: "POOL_CLOSED" });
  });

  it.each([
    [
      "HGETALL",
      ["HGETALL", "user:1"],
      ["email", "a@b.co", "visits", "12"],
      ["field", "value"],
      [
        ["email", "a@b.co"],
        ["visits", 12],
      ],
    ],
    [
      "ZREVRANGE WITHSCORES",
      ["ZREVRANGE", "leaderboard", 0, 1, "WITHSCORES"],
      ["alice", "300", "bob", "120.5"],
      ["member", "score"],
      [
        ["alice", 300],
        ["bob", 120.5],
      ],
    ],
    [
      "ZRANGE",
      ["ZRANGE", "leaderboard", 0, 1],
      ["alice", "bob"],
      ["member"],
      [["alice"], ["bob"]],
    ],
    [
      "LRANGE",
      ["LRANGE", "queue", 0, 1],
      ["job-1", "job-2"],
      ["value"],
      [["job-1"], ["job-2"]],
    ],
    ["HKEYS", ["HKEYS", "user:1"], ["email"], ["field"], [["email"]]],
    ["HVALS", ["HVALS", "user:1"], ["a@b.co"], ["value"], [["a@b.co"]]],
    ["SMEMBERS", ["SMEMBERS", "tags"], ["red"], ["member"], [["red"]]],
    ["SRANDMEMBER", ["SRANDMEMBER", "tags"], "red", ["member"], [["red"]]],
    [
      "HRANDFIELD WITHVALUES",
      ["HRANDFIELD", "user:1", 1, "WITHVALUES"],
      ["email", "a@b.co"],
      ["field", "value"],
      [["email", "a@b.co"]],
    ],
    ["HRANDFIELD", ["HRANDFIELD", "user:1"], "email", ["field"], [["email"]]],
    [
      "XRANGE",
      ["XRANGE", "events", "-", "+", "COUNT", 2],
      [
        ["1-0", ["type", "signup", "plan", "pro"]],
        ["2-0", ["type", "login"]],
        "noise",
      ],
      ["id", "type", "plan"],
      [
        ["1-0", "signup", "pro"],
        ["2-0", "login", null],
      ],
    ],
  ])(
    "shapes %s replies into rows",
    async (_label, command, reply, names, rows) => {
      const fake = fakeRedis({ reply: () => reply });
      const result = await runRedisReadPlan(
        fake.pool,
        commands(command),
        "0",
        2000,
        signal()
      );
      expect(result.columns.map((column) => column.name)).toStrictEqual(names);
      expect(result.rows).toStrictEqual(rows);
    }
  );

  it("returns no rows for a missing collection", async () => {
    const fake = fakeRedis({ reply: () => null });
    const result = await runRedisReadPlan(
      fake.pool,
      commands(["SRANDMEMBER", "missing"]),
      "0",
      10,
      signal()
    );
    expect(result.rows).toStrictEqual([]);
  });

  it("zips MGET with its keys and HMGET with its fields", async () => {
    const fake = fakeRedis({
      reply: replies({
        "HMGET user:1 email visits": ["a@b.co", "3"],
        "MGET rate:a rate:b": ["5", null],
      }),
    });
    const mget = await runRedisReadPlan(
      fake.pool,
      commands(["MGET", "rate:a", "rate:b"]),
      "0",
      10,
      signal()
    );
    expect(mget.rows).toStrictEqual([
      ["rate:a", 5],
      ["rate:b", null],
    ]);
    const hmget = await runRedisReadPlan(
      fake.pool,
      commands(["HMGET", "user:1", "email", "visits"]),
      "0",
      10,
      signal()
    );
    expect(hmget.columns.map((column) => column.name)).toStrictEqual([
      "field",
      "key",
      "value",
    ]);
    expect(hmget.rows).toStrictEqual([
      ["email", "user:1", "a@b.co"],
      ["visits", "user:1", 3],
    ]);
  });

  it("labels each row with its command when a plan has several", async () => {
    const fake = fakeRedis({
      reply: replies({
        "MEMORY USAGE user:1": 72,
        "MGET a b": ["1", "2"],
        "SCARD online": 4,
      }),
    });
    const result = await runRedisReadPlan(
      fake.pool,
      commands(
        ["SCARD", "online"],
        ["MGET", "a", "b"],
        ["MEMORY", "USAGE", "user:1"]
      ),
      "0",
      10,
      signal()
    );
    expect(result.rows).toStrictEqual([
      ["SCARD", "online", 4],
      ["MGET", "a", 1],
      ["MGET", "b", 2],
      ["MEMORY", "user:1", 72],
    ]);
  });

  it("parses INFO into field and value rows", async () => {
    const fake = fakeRedis({
      reply: () =>
        "# Memory\r\nused_memory:1024\r\nused_memory_human:1.00K\r\n\r\n",
    });
    const result = await runRedisReadPlan(
      fake.pool,
      commands(["INFO", "memory"]),
      "0",
      10,
      signal()
    );
    expect(result.rows).toStrictEqual([
      ["used_memory", 1024],
      ["used_memory_human", "1.00K"],
    ]);
  });

  it("truncates to maxRows", async () => {
    const fake = fakeRedis({ reply: () => ["a", "b", "c"] });
    const result = await runRedisReadPlan(
      fake.pool,
      commands(["SMEMBERS", "tags"]),
      "0",
      2,
      signal()
    );
    expect(result.rows).toHaveLength(2);
    expect(result.isTruncated).toBeTruthy();
  });

  describe("scan plans", () => {
    const keys = [
      "session:aaaaaaaaaaaa1",
      "session:aaaaaaaaaaaa2",
      "session:aaaaaaaaaaaa3",
      "user:1:cart",
      "user:2:cart",
      "leaderboard",
    ];

    it("counts keys by pattern, largest first", async () => {
      const fake = fakeRedis({ keys, pageSize: 2 });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ match: "*", measure: "count" }),
        "0",
        2000,
        signal()
      );
      expect(result.columns).toStrictEqual([
        { name: "group", typeName: "TEXT" },
        { name: "keys", typeName: "NUMERIC" },
      ]);
      expect(result.rows).toStrictEqual([
        ["session:*", 3],
        ["user:*:cart", 2],
        ["leaderboard", 1],
      ]);
      expect(result.isTruncated).toBeFalsy();
      expect(fake.scan).toHaveBeenCalledWith("0", "MATCH", "*", "COUNT", 500);
    });

    const perKey = (command: string, session: unknown, other: unknown) =>
      replies(
        Object.fromEntries(
          keys.map((key) => [
            `${command} ${key}`,
            key.startsWith("session") ? session : other,
          ])
        )
      );

    it("groups by type and honours the limit", async () => {
      const fake = fakeRedis({ keys, reply: perKey("TYPE", "hash", "string") });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ groupBy: "type", limit: 1, match: "*", measure: "count" }),
        "0",
        2000,
        signal()
      );
      expect(result.rows).toStrictEqual([["hash", 3]]);
    });

    it("estimates memory per group from the measured keys", async () => {
      const fake = fakeRedis({
        keys,
        reply: perKey("MEMORY USAGE", 100, 10),
      });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ groupBy: "none", match: "*", measure: "memory" }),
        "0",
        2000,
        signal()
      );
      expect(result.rows).toStrictEqual([["*", 6, 330]]);
      expect(result.columns.at(-1)).toStrictEqual({
        name: "memory_bytes",
        typeName: "NUMERIC",
      });
    });

    it("averages TTLs, ignoring keys that never expire", async () => {
      const fake = fakeRedis({ keys, reply: perKey("PTTL", 60_000, -1) });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ match: "*", measure: "ttl" }),
        "0",
        2000,
        signal()
      );
      expect(result.rows).toStrictEqual([
        ["session:*", 3, 60],
        ["user:*:cart", 2, null],
        ["leaderboard", 1, null],
      ]);
    });

    it("flags truncation when the scan hits its iteration bound", async () => {
      const fake = fakeRedis({ endless: true, keys, pageSize: 1 });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ match: "*", measure: "count" }),
        "0",
        2000,
        signal()
      );
      expect(fake.scan).toHaveBeenCalledTimes(50);
      expect(result.isTruncated).toBeTruthy();
    });

    it("measures at most 2,000 keys and flags the sample", async () => {
      const many = Array.from({ length: 2500 }, (_, n) => `item:${n}`);
      const fake = fakeRedis({ keys: many, reply: () => 8 });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ match: "item:*", measure: "memory" }),
        "0",
        2000,
        signal()
      );
      expect(result.rows).toStrictEqual([["item:*", 2500, 20_000]]);
      expect(result.isTruncated).toBeTruthy();
    });

    it("stops scanning at 10,000 keys", async () => {
      const many = Array.from({ length: 12_000 }, (_, n) => `k:${n}`);
      const fake = fakeRedis({ keys: many });
      const result = await runRedisReadPlan(
        fake.pool,
        scan({ match: "*", measure: "count" }),
        "0",
        2000,
        signal()
      );
      expect(result.rows).toStrictEqual([["k:*", 10_000]]);
      expect(result.isTruncated).toBeTruthy();
    });
  });
});

describe("reply helpers", () => {
  it.each([
    ["42", 42],
    ["-1.5", -1.5],
    ["12345678901234567890", "12345678901234567890"],
    ["1e400", "1e400"],
    ["007abc", "007abc"],
    [Buffer.from("7"), 7],
    [null, null],
  ])("reads %o as %o", (reply, cell) => {
    expect(toCell(reply)).toStrictEqual(cell);
  });

  it("skips INFO headers and blank lines", () => {
    expect(parseInfo("# Server\nredis_version:7.2.4\n\n")).toStrictEqual([
      { field: "redis_version", value: "7.2.4" },
    ]);
    expect(parseInfo(null)).toStrictEqual([]);
  });
});

const FIXTURE_URL = process.env.OMQ_REDIS_URL ?? "redis://127.0.0.1:6379/0";

const connectFixture = async (): Promise<Redis | null> => {
  const client = new Redis(FIXTURE_URL, {
    connectTimeout: 1000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  try {
    await client.connect();
    await client.ping();
    return client;
  } catch {
    client.disconnect();
    return null;
  }
};

const fixture = await connectFixture();

describe.skipIf(!fixture)("runRedisReadPlan (fixture database)", () => {
  const client = () => fixture as Redis;
  const prefix = `omq_ask_${process.pid}`;
  const pool = () => new RedisPool(client(), 0);

  afterAll(async () => {
    const keys = await client().keys(`${prefix}:*`);
    if (keys.length > 0) {
      await client().del(...keys);
    }
    await client().quit();
  });

  it("answers scans and commands, and refuses SET before the server sees it", async () => {
    await client()
      .multi()
      .hset(`${prefix}:session:aaaaaaaaaaaa1`, { ip: "10.0.0.1", user_id: "1" })
      .hset(`${prefix}:session:aaaaaaaaaaaa2`, { ip: "10.0.0.2", user_id: "2" })
      .zadd(`${prefix}:leaderboard`, 300, "alice", 120, "bob", 90, "carol")
      .exec();

    const byPattern = await runRedisReadPlan(
      pool(),
      scan({ match: `${prefix}:*`, measure: "count" }),
      "0",
      2000,
      signal()
    );
    expect(byPattern.rows).toStrictEqual([
      [`${prefix}:session:*`, 2],
      [`${prefix}:leaderboard`, 1],
    ]);

    const top = await runRedisReadPlan(
      pool(),
      commands(["ZREVRANGE", `${prefix}:leaderboard`, 0, 1, "WITHSCORES"]),
      "0",
      2000,
      signal()
    );
    expect(top.rows).toStrictEqual([
      ["alice", 300],
      ["bob", 120],
    ]);

    const memory = await runRedisReadPlan(
      pool(),
      scan({ groupBy: "type", match: `${prefix}:*`, measure: "memory" }),
      "0",
      2000,
      signal()
    );
    expect(memory.rows.map((row) => row[0])).toStrictEqual(["hash", "zset"]);

    await expect(
      runRedisReadPlan(
        pool(),
        commands(["SET", `${prefix}:written`, "1"]),
        "0",
        2000,
        signal()
      )
    ).rejects.toMatchObject({ code: "NOT_READ_ONLY" });
    await expect(client().exists(`${prefix}:written`)).resolves.toBe(0);
  });

  it("reads the keyspace into patterns for the schema", async () => {
    const schema = await pool().fetchSchema("0");
    const names = schema.schemas[0]?.tables.map((table) => table.name);
    expect(names).toContain(`${prefix}:session:*`);
    const sessions = schema.schemas[0]?.tables.find(
      (table) => table.name === `${prefix}:session:*`
    );
    expect(
      sessions?.columns.map((column) => column.name).toSorted()
    ).toStrictEqual(["ip", "user_id"]);
  });
});
