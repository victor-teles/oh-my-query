import type { SchemaInfo } from "@oh-my-query/core";

import { describe, expect, it } from "vitest";

import {
  formatMongoSchema,
  formatRedisSchema,
  formatSchemaForPrompt,
} from "./schema-prompt.ts";
import { column, table } from "./test-fixtures.ts";

type Tables = SchemaInfo["schemas"][number]["tables"];

const makeSchema = (tables: Tables): SchemaInfo => ({
  schemas: [{ name: "public", tables, views: [] }],
});

const usersTable: Tables[number] = {
  columns: [
    {
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    },
    {
      dataType: "text",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: false,
      name: "email",
    },
  ],
  foreignKeys: [],
  indexes: [],
  name: "users",
  rowEstimate: 100,
};

describe("formatSchemaForPrompt — index hardening", () => {
  it("renders a well-formed non-PK index (regression guard)", () => {
    const output = formatSchemaForPrompt(
      makeSchema([
        {
          ...usersTable,
          indexes: [
            { columns: ["email"], isUnique: true, name: "users_email_idx" },
          ],
        },
      ]),
      "postgresql"
    );
    expect(output).toContain("Index: users_email_idx (email, unique)");
  });

  it("skips an index whose only column is the primary key", () => {
    const output = formatSchemaForPrompt(
      makeSchema([
        {
          ...usersTable,
          indexes: [{ columns: ["id"], isUnique: true, name: "users_pkey" }],
        },
      ]),
      "postgresql"
    );
    expect(output).not.toContain("Index:");
  });

  it("does not throw when an index has columns: undefined", () => {
    const malformed = {
      ...usersTable,
      indexes: [
        {
          columns: undefined as unknown as string[],
          isUnique: false,
          name: "users_broken_idx",
        },
      ],
    };
    expect(() =>
      formatSchemaForPrompt(makeSchema([malformed]), "postgresql")
    ).not.toThrow();
    const output = formatSchemaForPrompt(makeSchema([malformed]), "postgresql");
    expect(output).not.toContain("users_broken_idx");
  });

  it("does not throw when columns is the literal string '{a,b}' (parser-failure case)", () => {
    const malformed = {
      ...usersTable,
      indexes: [
        {
          columns: "{email,id}" as unknown as string[],
          isUnique: false,
          name: "users_string_idx",
        },
      ],
    };
    expect(() =>
      formatSchemaForPrompt(makeSchema([malformed]), "postgresql")
    ).not.toThrow();
    const output = formatSchemaForPrompt(makeSchema([malformed]), "postgresql");
    expect(output).not.toContain("users_string_idx");
  });

  it("does not throw when table.indexes itself is undefined", () => {
    const malformed = {
      ...usersTable,
      indexes: undefined as unknown as [],
    };
    expect(() =>
      formatSchemaForPrompt(makeSchema([malformed]), "postgresql")
    ).not.toThrow();
  });
});

describe("formatSchemaForPrompt — content", () => {
  it("labels the dialect, qualifies non-default schemas and maps foreign keys", () => {
    const schema: SchemaInfo = {
      schemas: [
        {
          name: "analytics",
          tables: [
            {
              ...usersTable,
              foreignKeys: [
                {
                  columns: ["email"],
                  name: "fk",
                  referencedColumns: ["address"],
                  referencedTable: "mailboxes",
                },
              ],
            },
          ],
          views: [{ columns: usersTable.columns, name: "active_users" }],
        },
      ],
    };
    const output = formatSchemaForPrompt(schema, "duckdb");
    expect(output).toContain("Database type: DuckDB");
    expect(output).toContain("Table: analytics.users");
    expect(output).toContain("email (text, NOT NULL) → mailboxes.address");
    expect(output).toContain("View: analytics.active_users (id, email)");
  });

  it("notes omitted tables", () => {
    const output = formatSchemaForPrompt(makeSchema([usersTable]), "mysql", {
      omittedTables: 12,
    });
    expect(output).toContain("12 more tables were omitted");
  });

  it("redacts PII in names and defaults when enabled", () => {
    const schema = makeSchema([
      {
        ...usersTable,
        columns: [
          {
            dataType: "text",
            defaultValue: null,
            isNullable: true,
            isPrimaryKey: false,
            name: "owner_ops@example.com",
          },
        ],
      },
    ]);
    const redacted = formatSchemaForPrompt(schema, "postgresql", {
      redact: { customPatterns: [], enabled: true },
    });
    const plain = formatSchemaForPrompt(schema, "postgresql");
    expect(redacted).not.toContain("ops@example.com");
    expect(plain).toContain("ops@example.com");
  });
});

describe("formatMongoSchema", () => {
  it("lists collections with sampled field types and estimates", () => {
    const schema: SchemaInfo = {
      schemas: [
        {
          name: "shop",
          tables: [
            table("orders", [], 12_400, [
              column("_id", "objectId"),
              column("created_at", "date"),
              column("items", "array<object>"),
              column("items.sku", "string"),
            ]),
            table("events", [], null, []),
            table("singletons", [], 1, []),
          ],
          views: [{ columns: [], name: "active_orders" }],
        },
      ],
    };
    expect(formatMongoSchema(schema, { omittedTables: 2 })).toBe(
      [
        "Database type: MongoDB",
        "",
        "orders (≈12,400 docs): _id objectId, created_at date, items array<object>, items.sku string",
        "events",
        "singletons (≈1 doc)",
        "active_orders (view)",
        "(2 more tables were omitted as unrelated to the question.)",
      ].join("\n")
    );
  });

  it("redacts field names that look like PII when asked", () => {
    const schema = makeSchema([
      table("users", [], 1, [column("ops@example.com", "string")]),
    ]);
    expect(
      formatMongoSchema(schema, {
        redact: { customPatterns: [], enabled: true },
      })
    ).not.toContain("ops@example.com");
  });
});

describe("formatRedisSchema", () => {
  it("lists key patterns with their type, estimate and hash fields", () => {
    const schema = makeSchema([
      table("session:*", [], 3400, [column("user_id"), column("ip")]),
      table("leaderboard:*", [], 4, [column("value", "zset")]),
      table("greeting", [], 1, [column("value", "string")]),
      table("empty:*", [], 2, []),
    ]);
    expect(formatRedisSchema(schema)).toBe(
      [
        "Database type: Redis",
        "",
        "session:* (hash, ≈3,400 keys): user_id, ip",
        "leaderboard:* (zset, ≈4 keys)",
        "greeting (string, ≈1 key)",
        "empty:* (hash, ≈2 keys)",
      ].join("\n")
    );
  });

  it("says when there are no keys", () => {
    expect(formatRedisSchema(makeSchema([]))).toBe(
      "Database type: Redis\n\n(No keys were found.)"
    );
  });
});
