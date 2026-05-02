import { describe, expect, it } from "vitest";

import { DbError } from "./error.ts";
import { formatSql, transpileSql } from "./transpile.ts";

function captureThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("transpileSql", () => {
  it("returns input unchanged when source equals target dialect", () => {
    const sql = "SELECT 1";
    expect(transpileSql(sql, "postgres", "postgresql")).toBe(sql);
  });

  it("treats postgres and postgresql as the same dialect (no SDK call)", () => {
    const sql = "SELECT 'identical'";
    expect(transpileSql(sql, "postgresql", "postgresql")).toBe(sql);
  });

  it("is case-insensitive for dialect names", () => {
    const sql = "SELECT 1";
    expect(transpileSql(sql, "POSTGRES", "postgresql")).toBe(sql);
  });

  it("transpiles between distinct dialects and returns non-empty SQL", () => {
    const out = transpileSql("SELECT 1", "postgres", "mysql");
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/SELECT/i);
  });

  it("throws UNSUPPORTED_DIALECT for an unknown source dialect", () => {
    const err = captureThrow(() =>
      transpileSql("SELECT 1", "fakedb", "postgres")
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED_DIALECT");
    expect((err as DbError).message).toContain("fakedb");
  });

  it("throws UNSUPPORTED_DIALECT for an unknown target dialect", () => {
    const err = captureThrow(() =>
      transpileSql("SELECT 1", "postgres", "fakedb" as never)
    );
    expect((err as DbError).code).toBe("UNSUPPORTED_DIALECT");
  });

  it("throws TRANSPILE_ERROR when the SDK rejects invalid SQL", () => {
    const err = captureThrow(() =>
      transpileSql("SELECT FROM", "postgres", "mysql")
    );
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("TRANSPILE_ERROR");
  });
});

describe("formatSql", () => {
  it("returns formatted SQL preserving the SELECT keyword", () => {
    const out = formatSql("select 1", "postgres");
    expect(out).toMatch(/SELECT/);
  });

  it("joins multiple statements with ';\\n\\n'", () => {
    const out = formatSql("select 1; select 2", "postgres");
    expect(out).toContain(";\n\n");
  });

  it("throws UNSUPPORTED_DIALECT for an unknown dialect", () => {
    const err = captureThrow(() => formatSql("SELECT 1", "fakedb"));
    expect((err as DbError).code).toBe("UNSUPPORTED_DIALECT");
  });

  it("throws FORMAT_ERROR for SQL the SDK cannot parse", () => {
    const err = captureThrow(() => formatSql("SELECT FROM WHERE", "postgres"));
    expect((err as DbError).code).toBe("FORMAT_ERROR");
  });
});
