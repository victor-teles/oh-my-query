import { describe, expect, it } from "vitest";

import {
  parseRedisReadPlan,
  REDIS_READ_COMMANDS,
  redisCommandShape,
} from "./redis-read-plan.ts";

const commands = (...list: unknown[][]) =>
  JSON.stringify({ commands: list, kind: "commands" });

const reasonOf = (text: string): string | null => {
  const parsed = parseRedisReadPlan(text);
  return parsed.ok ? null : parsed.reason;
};

const MINIMAL: Record<(typeof REDIS_READ_COMMANDS)[number], unknown[]> = {
  BITCOUNT: ["BITCOUNT", "flags"],
  DBSIZE: ["DBSIZE"],
  EXISTS: ["EXISTS", "a", "b"],
  GET: ["GET", "greeting"],
  GETRANGE: ["GETRANGE", "greeting", 0, 4],
  HEXISTS: ["HEXISTS", "user:1", "email"],
  HGET: ["HGET", "user:1", "email"],
  HGETALL: ["HGETALL", "user:1"],
  HKEYS: ["HKEYS", "user:1"],
  HLEN: ["HLEN", "user:1"],
  HMGET: ["HMGET", "user:1", "email", "name"],
  HRANDFIELD: ["HRANDFIELD", "user:1", 5, "WITHVALUES"],
  HVALS: ["HVALS", "user:1"],
  INFO: ["INFO", "memory"],
  LINDEX: ["LINDEX", "queue", 0],
  LLEN: ["LLEN", "queue"],
  LRANGE: ["LRANGE", "queue", 0, 99],
  MEMORY: ["MEMORY", "USAGE", "user:1"],
  MGET: ["MGET", "a", "b"],
  PFCOUNT: ["PFCOUNT", "visitors"],
  PTTL: ["PTTL", "session:1"],
  SCARD: ["SCARD", "tags"],
  SISMEMBER: ["SISMEMBER", "tags", "red"],
  SMEMBERS: ["SMEMBERS", "tags"],
  SRANDMEMBER: ["SRANDMEMBER", "tags", 3],
  STRLEN: ["STRLEN", "greeting"],
  TTL: ["TTL", "session:1"],
  TYPE: ["TYPE", "session:1"],
  XLEN: ["XLEN", "events"],
  XRANGE: ["XRANGE", "events", "-", "+", "COUNT", 100],
  XREVRANGE: ["XREVRANGE", "events", "+", "-", "COUNT", 10],
  ZCARD: ["ZCARD", "leaderboard"],
  ZCOUNT: ["ZCOUNT", "leaderboard", 0, 100],
  ZRANGE: ["ZRANGE", "leaderboard", 0, 9, "WITHSCORES"],
  ZRANGEBYSCORE: ["ZRANGEBYSCORE", "leaderboard", 0, "+inf", "LIMIT", 0, 10],
  ZRANK: ["ZRANK", "leaderboard", "alice"],
  ZREVRANGE: ["ZREVRANGE", "leaderboard", 0, 9, "WITHSCORES"],
  ZREVRANGEBYSCORE: ["ZREVRANGEBYSCORE", "leaderboard", "+inf", 0],
  ZREVRANK: ["ZREVRANK", "leaderboard", "alice"],
  ZSCORE: ["ZSCORE", "leaderboard", "alice"],
};

describe("parseRedisReadPlan", () => {
  it.each(REDIS_READ_COMMANDS)("allows %s", (name) => {
    expect(parseRedisReadPlan(commands(MINIMAL[name]))).toMatchObject({
      ok: true,
    });
  });

  it("passes a realistic list of single values and upper-cases names", () => {
    const parsed = parseRedisReadPlan(
      JSON.stringify({
        commands: [
          ["get", "stats:signups:today"],
          ["SCARD", "online:users"],
          ["ZSCORE", "leaderboard", "alice"],
          ["MGET", "rate:a", "rate:b"],
        ],
        description: "Today at a glance",
        kind: "commands",
      })
    );
    expect(parsed).toStrictEqual({
      ok: true,
      plan: {
        commands: [
          ["GET", "stats:signups:today"],
          ["SCARD", "online:users"],
          ["ZSCORE", "leaderboard", "alice"],
          ["MGET", "rate:a", "rate:b"],
        ],
        description: "Today at a glance",
        kind: "commands",
      },
    });
  });

  it("passes a scan plan", () => {
    const plan = {
      groupBy: "pattern",
      kind: "scan",
      limit: 20,
      match: "session:*",
      measure: "memory",
    };
    expect(parseRedisReadPlan(JSON.stringify(plan))).toStrictEqual({
      ok: true,
      plan,
    });
  });

  it.each([
    [["SET", "a", "1"], "SET writes data"],
    [["setex", "a", 10, "1"], "SETEX writes data"],
    [["DEL", "a"], "DEL deletes data"],
    [["UNLINK", "a"], "UNLINK deletes data"],
    [["FLUSHALL"], "FLUSHALL deletes data"],
    [["FLUSHDB"], "FLUSHDB deletes data"],
    [["EVAL", "return 1", 0], "EVAL runs server-side scripts"],
    [["EVALSHA", "abc", 0], "EVALSHA runs server-side scripts"],
    [["FCALL", "f", 0], "FCALL runs server-side scripts"],
    [["SCRIPT", "LOAD", "x"], "SCRIPT runs server-side scripts"],
    [["FUNCTION", "LIST"], "FUNCTION runs server-side scripts"],
    [["CONFIG", "GET", "*"], "CONFIG changes server settings"],
    [["DEBUG", "SLEEP", 1], "DEBUG changes server settings"],
    [["SORT", "list"], "SORT can write its result with STORE"],
    [["SUNIONSTORE", "d", "a", "b"], "SUNIONSTORE writes data"],
    [["ZRANGESTORE", "d", "a", 0, 1], "ZRANGESTORE writes data"],
  ])("rejects %j", (command, reason) => {
    expect(reasonOf(commands(command))).toBe(
      `${reason}; only read commands can run here.`
    );
  });

  it("points KEYS at a scan plan", () => {
    expect(reasonOf(commands(["KEYS", "*"]))).toBe(
      "KEYS blocks the server while it reads every key; use a scan plan instead."
    );
  });

  it("rejects a write hidden after allowed commands", () => {
    expect(reasonOf(commands(["GET", "a"], ["SCARD", "b"], ["DEL", "a"]))).toBe(
      "DEL deletes data; only read commands can run here."
    );
  });

  it("rejects anything outside the allowlist", () => {
    expect(reasonOf(commands(["CLIENT", "LIST"]))).toBe(
      "CLIENT is not in the read-only command list."
    );
    expect(reasonOf(commands(["SORT_RO", "list"]))).toBe(
      "SORT_RO is not in the read-only command list."
    );
  });

  it("only allows MEMORY USAGE and known INFO sections", () => {
    expect(reasonOf(commands(["MEMORY", "PURGE"]))).toBe(
      "Only MEMORY USAGE <key> can run here."
    );
    expect(reasonOf(commands(["MEMORY", "USAGE"]))).toBe(
      "Only MEMORY USAGE <key> can run here."
    );
    expect(reasonOf(commands(["INFO"]))).toContain("INFO needs one section");
    expect(reasonOf(commands(["INFO", "commandstats"]))).toContain(
      "INFO needs one section"
    );
  });

  it.each([
    [["LRANGE", "q", 0, 1999]],
    [["LRANGE", "q", -100, -1]],
    [["ZRANGE", "z", 0, "+inf", "BYSCORE", "LIMIT", 0, 5]],
  ])("allows the bounded range %j", (command) => {
    expect(reasonOf(commands(command))).toBeNull();
  });

  it.each([
    [["LRANGE", "q", 0, 2000], "LRANGE asks for more than 2,000 items"],
    [["LRANGE", "q", 0, -1], "LRANGE asks for more than 2,000 items"],
    [["ZRANGE", "z", 0, -1], "ZRANGE asks for more than 2,000 items"],
    [["LRANGE", "q", "a", 3], "LRANGE needs a numeric start and stop."],
  ])("refuses the unbounded range %j", (command, reason) => {
    expect(reasonOf(commands(command))).toContain(reason);
  });

  it("rejects STORE options and unbounded streams or samples", () => {
    expect(reasonOf(commands(["ZRANGE", "z", 0, 9, "STORE"]))).toBe(
      "ZRANGE STORE writes data; only read commands can run here."
    );
    expect(reasonOf(commands(["XRANGE", "events", "-", "+"]))).toBe(
      "XRANGE needs COUNT n with n up to 2000."
    );
    expect(
      reasonOf(commands(["XRANGE", "events", "-", "+", "COUNT", 5000]))
    ).toBe("XRANGE needs COUNT n with n up to 2000.");
    expect(reasonOf(commands(["SRANDMEMBER", "tags", -5000]))).toBe(
      "SRANDMEMBER asks for more than 2,000 items."
    );
    expect(reasonOf(commands(["SRANDMEMBER", "tags"]))).toBeNull();
  });

  it("reads one collection, or single values, never both", () => {
    const reason =
      "A plan reads one collection, or a list of single values, not both.";
    expect(reasonOf(commands(["HGETALL", "a"], ["HGETALL", "b"]))).toBe(reason);
    expect(reasonOf(commands(["HGETALL", "a"], ["GET", "b"]))).toBe(reason);
  });

  it.each([
    ["not JSON", "GET greeting"],
    ["an unknown kind", JSON.stringify({ kind: "eval" })],
    ["no commands", commands()],
    [
      "more than 20 commands",
      commands(...Array.from({ length: 21 }, () => ["GET", "a"])),
    ],
    [
      "more than 10 args",
      commands(["MGET", ...Array.from({ length: 11 }, () => "k")]),
    ],
    ["an oversized arg", commands(["GET", "k".repeat(513)])],
    ["a non-string arg", commands(["GET", { key: "a" }])],
    [
      "a scan with a big limit",
      JSON.stringify({
        groupBy: "type",
        kind: "scan",
        limit: 500,
        match: "*",
        measure: "count",
      }),
    ],
    [
      "a scan with an unknown measure",
      JSON.stringify({
        groupBy: "type",
        kind: "scan",
        limit: 5,
        match: "*",
        measure: "size",
      }),
    ],
  ])("rejects a plan with %s", (_label, text) => {
    expect(reasonOf(text)).toBe(
      'The reply must be a {"kind": "commands"} or {"kind": "scan"} plan.'
    );
  });

  it("rejects an oversized reply", () => {
    expect(reasonOf(" ".repeat(20_001))).toBe("The plan is longer than 20 KB.");
  });

  it("knows each command's reply shape", () => {
    expect(redisCommandShape("get")).toBe("scalar");
    expect(redisCommandShape("MGET")).toBe("keyed");
    expect(redisCommandShape("zrange")).toBe("collection");
    expect(redisCommandShape("SET")).toBeNull();
  });
});
