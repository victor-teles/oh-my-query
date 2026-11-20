import type { SchemaInfo } from "@oh-my-query/core";

import { describe, expect, it } from "vitest";

import { formatSchemaForPrompt } from "./schema-prompt.ts";

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
