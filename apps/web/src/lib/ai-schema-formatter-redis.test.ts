import { describe, expect, it } from "vitest";

import type { RedisKey, SchemaInfo } from "@/lib/tauri";

import {
  buildSystemPrompt,
  formatSchemaForPrompt,
} from "@/lib/ai-schema-formatter";

const emptyRedisSchema: SchemaInfo = {
  schemas: [{ name: "db0", tables: [], views: [] }],
};

const sampleKeys: RedisKey[] = [
  {
    kind: "STRING",
    name: "session:abc",
    size: 12,
    sizeUnit: "bytes",
    ttlSecs: 300,
  },
  {
    kind: "HASH",
    name: "user:1",
    size: 5,
    sizeUnit: "fields",
    ttlSecs: null,
  },
  {
    kind: "ZSET",
    name: "leaderboard",
    size: 100,
    sizeUnit: "members",
    ttlSecs: null,
  },
];

describe("redis schema formatter", () => {
  it("labels the output as Redis", () => {
    const output = formatSchemaForPrompt(emptyRedisSchema, "redis", sampleKeys);
    expect(output).toContain("Database type: Redis");
    expect(output).toContain("Database: db0");
  });

  it("groups keys by type", () => {
    const output = formatSchemaForPrompt(emptyRedisSchema, "redis", sampleKeys);
    expect(output).toContain("STRING (1 key)");
    expect(output).toContain("HASH (1 key)");
    expect(output).toContain("ZSET (1 key)");
  });

  it("renders key metadata (TTL, size) alongside each key", () => {
    const output = formatSchemaForPrompt(emptyRedisSchema, "redis", sampleKeys);
    expect(output).toContain("session:abc — TTL 5m · 12 bytes");
    expect(output).toContain("user:1 — no expiry · 5 fields");
  });

  it("handles no sampled keys", () => {
    const output = formatSchemaForPrompt(
      { schemas: [{ name: "db3", tables: [], views: [] }] },
      "redis",
      []
    );
    expect(output).toContain("Database: db3");
    expect(output).toContain("(no keys sampled");
  });

  it("orders kinds sensibly (STRING before HASH before ZSET)", () => {
    const output = formatSchemaForPrompt(emptyRedisSchema, "redis", sampleKeys);
    const stringIdx = output.indexOf("STRING");
    const hashIdx = output.indexOf("HASH");
    const zsetIdx = output.indexOf("ZSET");
    expect(stringIdx).toBeLessThan(hashIdx);
    expect(hashIdx).toBeLessThan(zsetIdx);
  });

  it("builds a Redis-specific system prompt, not a SQL one", () => {
    const prompt = buildSystemPrompt(emptyRedisSchema, "redis", sampleKeys);
    expect(prompt).toContain("Redis assistant");
    expect(prompt).toContain("HGETALL");
    expect(prompt).toContain("ZRANGE");
    expect(prompt).not.toMatch(/SELECT \*/i);
    expect(prompt).not.toContain("SQL dialect");
  });

  it("keeps SQL prompt for non-redis types", () => {
    const prompt = buildSystemPrompt(emptyRedisSchema, "postgresql");
    expect(prompt).toContain("PostgreSQL");
    expect(prompt).toContain("SQL");
  });
});
