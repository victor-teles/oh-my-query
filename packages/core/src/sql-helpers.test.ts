import { describe, expect, it } from "vitest";

import { DbError } from "./error.ts";
import { guardDestructive, validateSchemaName } from "./sql-helpers.ts";

function captureThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

const headOf = (sql: string): string =>
  sql.split(/\s+/, 1).join("").toUpperCase();

describe("validateSchemaName", () => {
  it.each(["public", "my_schema", "schema.with.dots", "with-dash", "abc123"])(
    "accepts %s",
    (name) => {
      expect(() => validateSchemaName(name)).not.toThrow();
    }
  );

  it.each(["", "has space", "weird;drop", "a/b", "café"])(
    "rejects %s with INVALID_SCHEMA",
    (name) => {
      const err = captureThrow(() => validateSchemaName(name));
      expect(err).toBeInstanceOf(DbError);
      expect((err as DbError).code).toBe("INVALID_SCHEMA");
      expect((err as DbError).message).toContain(name);
    }
  );
});

describe("guardDestructive", () => {
  it.each([
    "SELECT 1",
    "select 1",
    "WITH cte AS (SELECT 1) SELECT * FROM cte",
    "VALUES (1)",
    "TABLE foo",
    "SHOW TABLES",
  ])("accepts %s", (sql) => {
    expect(() => guardDestructive(sql)).not.toThrow();
  });

  it.each([
    "INSERT INTO t VALUES (1)",
    "UPDATE t SET x = 1",
    "DELETE FROM t",
    "DROP TABLE t",
    "TRUNCATE TABLE t",
    "CREATE TABLE t (id int)",
  ])("rejects %s with EXPLAIN_DESTRUCTIVE", (sql) => {
    const err = captureThrow(() => guardDestructive(sql));
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("EXPLAIN_DESTRUCTIVE");
    expect((err as DbError).message).toContain(headOf(sql));
  });

  it("treats leading whitespace as missing head and refuses", () => {
    expect(() => guardDestructive("   SELECT 1")).toThrow(DbError);
  });

  it("refuses empty SQL", () => {
    const err = captureThrow(() => guardDestructive(""));
    expect((err as DbError).code).toBe("EXPLAIN_DESTRUCTIVE");
  });
});
