import { describe, expect, it } from "vitest";

import type { SchemaInfo } from "@/lib/tauri";

import { formatSchemaForPrompt } from "@/lib/ai-schema-formatter";

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
