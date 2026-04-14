import { describe, expect, it } from "vitest";

import {
  redisDeleteCommand,
  redisInspectCommand,
  redisTtlCommand,
  redisTypeCommand,
} from "@/lib/sql-templates";

describe("redis templates", () => {
  it("picks GET for string keys", () => {
    expect(redisInspectCommand("user:1:name", "STRING")).toBe(
      "GET user:1:name"
    );
  });

  it("picks HGETALL for hash keys", () => {
    expect(redisInspectCommand("user:1", "HASH")).toBe("HGETALL user:1");
  });

  it("picks LRANGE for list keys", () => {
    expect(redisInspectCommand("queue", "LIST")).toBe("LRANGE queue 0 99");
  });

  it("picks SMEMBERS for set keys", () => {
    expect(redisInspectCommand("tags", "SET")).toBe("SMEMBERS tags");
  });

  it("picks ZRANGE WITHSCORES for zset keys", () => {
    expect(redisInspectCommand("leaderboard", "ZSET")).toBe(
      "ZRANGE leaderboard 0 99 WITHSCORES"
    );
  });

  it("picks XRANGE for stream keys", () => {
    expect(redisInspectCommand("events", "STREAM")).toBe(
      "XRANGE events - + COUNT 100"
    );
  });

  it("falls back to TYPE for unknown kinds", () => {
    expect(redisInspectCommand("x", "MYSTERY")).toBe("TYPE x");
  });

  it("is case-insensitive on kind", () => {
    expect(redisInspectCommand("k", "hash")).toBe("HGETALL k");
  });

  it("quotes keys containing spaces", () => {
    expect(redisInspectCommand("my key", "STRING")).toBe('GET "my key"');
  });

  it("escapes embedded quotes", () => {
    expect(redisInspectCommand('user"1', "STRING")).toBe('GET "user\\"1"');
  });

  it("generates a DEL command", () => {
    expect(redisDeleteCommand("foo")).toBe("DEL foo");
  });

  it("generates a TYPE command", () => {
    expect(redisTypeCommand("foo")).toBe("TYPE foo");
  });

  it("generates a TTL command", () => {
    expect(redisTtlCommand("foo")).toBe("TTL foo");
  });
});
