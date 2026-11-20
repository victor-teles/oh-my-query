import { describe, expect, it } from "vitest";

import {
  limitedSelect,
  previewSql,
  qualifiedTable,
  quoteIdentifier,
} from "./sql-identifiers.ts";

const HOSTILE = 'x"; drop table t; --';

describe("quoteIdentifier", () => {
  it.each([
    ["postgresql", '"orders"'],
    ["sqlite", '"orders"'],
    ["duckdb", '"orders"'],
    ["snowflake", '"orders"'],
    ["redshift", '"orders"'],
    ["oracle", '"orders"'],
    ["mysql", "`orders`"],
    ["clickhouse", "`orders`"],
    ["bigquery", "`orders`"],
    ["tsql", "[orders]"],
  ] as const)("quotes for %s", (dialect, expected) => {
    expect(quoteIdentifier(dialect, "orders")).toBe(expected);
  });

  it.each([
    ["postgresql", 'a"b', '"a""b"'],
    ["mysql", "a`b", "`a``b`"],
    ["tsql", "a]b", "[a]]b]"],
    ["postgresql", "order items", '"order items"'],
    ["postgresql", "a;b--c", '"a;b--c"'],
    ["mysql", "a[b]", "`a[b]`"],
  ] as const)("escapes %s names like %s", (dialect, name, expected) => {
    expect(quoteIdentifier(dialect, name)).toBe(expected);
  });

  it.each([
    ["postgresql", '"x""; drop table t; --"'],
    ["mysql", '`x"; drop table t; --`'],
    ["tsql", '[x"; drop table t; --]'],
  ] as const)(
    "keeps a hostile name inside one %s identifier",
    (dialect, expected) => {
      expect(quoteIdentifier(dialect, HOSTILE)).toBe(expected);
    }
  );

  it.each(["", "a\0b"])("rejects %j", (name) => {
    expect(() => quoteIdentifier("postgresql", name)).toThrow(
      expect.objectContaining({ code: "INVALID_IDENTIFIER" })
    );
  });
});

describe("qualifiedTable", () => {
  it("joins the quoted schema and table", () => {
    expect(qualifiedTable("postgresql", "public", "orders")).toBe(
      '"public"."orders"'
    );
  });

  it("omits a null schema", () => {
    expect(qualifiedTable("sqlite", null, "orders")).toBe('"orders"');
  });
});

describe("limitedSelect", () => {
  it.each([
    ["postgresql", 'SELECT * FROM "t" LIMIT 5'],
    ["mysql", 'SELECT * FROM "t" LIMIT 5'],
    ["tsql", 'SELECT TOP (5) * FROM "t"'],
    ["oracle", 'SELECT * FROM "t" FETCH FIRST 5 ROWS ONLY'],
  ] as const)("uses the %s row limit", (dialect, expected) => {
    expect(limitedSelect(dialect, '"t"', "*", 5)).toBe(expected);
  });

  it("adds a where clause before the limit", () => {
    expect(limitedSelect("postgresql", '"t"', "1", 1, '"id" = {{value}}')).toBe(
      'SELECT 1 FROM "t" WHERE "id" = {{value}} LIMIT 1'
    );
    expect(limitedSelect("tsql", "[t]", "1", 1, "[id] = {{value}}")).toBe(
      "SELECT TOP (1) 1 FROM [t] WHERE [id] = {{value}}"
    );
  });

  it.each([0, -1, 1.5, Number.NaN, 2 ** 60])("rejects a limit of %s", (n) => {
    expect(() => limitedSelect("postgresql", '"t"', "*", n)).toThrow(
      expect.objectContaining({ code: "INVALID_LIMIT" })
    );
  });
});

describe("previewSql", () => {
  it("selects 50 rows by default", () => {
    expect(previewSql("postgresql", "public", "orders")).toBe(
      'SELECT * FROM "public"."orders" LIMIT 50'
    );
  });

  it("uses the dialect's quoting and limit", () => {
    expect(previewSql("tsql", "dbo", "Order Lines", 10)).toBe(
      "SELECT TOP (10) * FROM [dbo].[Order Lines]"
    );
  });
});
