import { describe, expect, it } from "vitest";

import type { SchemaInfo } from "@/lib/tauri";

import {
  buildSystemPrompt,
  formatSchemaForPrompt,
} from "@/lib/ai-schema-formatter";

const redisKeyspace: SchemaInfo = {
  schemas: [
    {
      name: "db0",
      tables: [
        {
          columns: [
            {
              dataType: "STRING",
              defaultValue: "TTL 300s · 12 bytes",
              isNullable: true,
              isPrimaryKey: false,
              name: "value",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "session:abc",
        },
        {
          columns: [
            {
              dataType: "HASH",
              defaultValue: "no expiry · 5 fields",
              isNullable: false,
              isPrimaryKey: false,
              name: "value",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "user:1",
        },
        {
          columns: [
            {
              dataType: "ZSET",
              defaultValue: "no expiry · 100 members",
              isNullable: false,
              isPrimaryKey: false,
              name: "value",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "leaderboard",
        },
      ],
      views: [],
    },
  ],
};

describe("redis schema formatter", () => {
  it("labels the output as Redis", () => {
    const output = formatSchemaForPrompt(redisKeyspace, "redis");
    expect(output).toContain("Database type: Redis");
    expect(output).toContain("Database: db0");
  });

  it("groups keys by type", () => {
    const output = formatSchemaForPrompt(redisKeyspace, "redis");
    expect(output).toContain("STRING (1 key)");
    expect(output).toContain("HASH (1 key)");
    expect(output).toContain("ZSET (1 key)");
  });

  it("renders key metadata (TTL, size) alongside each key", () => {
    const output = formatSchemaForPrompt(redisKeyspace, "redis");
    expect(output).toContain("session:abc — TTL 300s · 12 bytes");
    expect(output).toContain("user:1 — no expiry · 5 fields");
  });

  it("handles empty keyspace", () => {
    const output = formatSchemaForPrompt(
      { schemas: [{ name: "db3", tables: [], views: [] }] },
      "redis"
    );
    expect(output).toContain("Database: db3");
    expect(output).toContain("(no keys found");
  });

  it("orders kinds sensibly (STRING before HASH before ZSET)", () => {
    const output = formatSchemaForPrompt(redisKeyspace, "redis");
    const stringIdx = output.indexOf("STRING");
    const hashIdx = output.indexOf("HASH");
    const zsetIdx = output.indexOf("ZSET");
    expect(stringIdx).toBeLessThan(hashIdx);
    expect(hashIdx).toBeLessThan(zsetIdx);
  });

  it("builds a Redis-specific system prompt, not a SQL one", () => {
    const prompt = buildSystemPrompt(redisKeyspace, "redis");
    expect(prompt).toContain("Redis assistant");
    expect(prompt).toContain("HGETALL");
    expect(prompt).toContain("ZRANGE");
    expect(prompt).not.toMatch(/SELECT \*/i);
    expect(prompt).not.toContain("SQL dialect");
  });

  it("keeps SQL prompt for non-redis types", () => {
    const prompt = buildSystemPrompt(redisKeyspace, "postgresql");
    expect(prompt).toContain("PostgreSQL");
    expect(prompt).toContain("SQL");
  });
});
