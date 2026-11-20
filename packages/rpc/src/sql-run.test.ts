import { describe, expect, it } from "vitest";

import { MAX_RAW_SQL, RunSqlParams } from "./sql-run.ts";

const valid = {
  askId: "a1",
  connectionId: "analytics",
  database: null,
  source: { kind: "sql", sql: "select 1", title: "One" },
};

const MATCH_VALUE = { kind: "email", value: "ada@example.com" };
const MATCH = {
  column: "email",
  kind: "match",
  schema: "public",
  table: "users",
  value: MATCH_VALUE,
};

describe("runSqlParams", () => {
  it("accepts a match on a looked-up value", () => {
    expect(RunSqlParams.parse({ ...valid, source: MATCH })).toMatchObject({
      source: { kind: "match", table: "users", value: MATCH_VALUE },
    });
  });

  it("accepts a raw run and trims the SQL", () => {
    expect(
      RunSqlParams.parse({
        ...valid,
        source: { kind: "sql", sql: "  select 1  " },
      })
    ).toMatchObject({ source: { sql: "select 1" } });
  });

  it.each([
    ["empty SQL", { kind: "sql", sql: "   " }],
    ["SQL over the limit", { kind: "sql", sql: "x".repeat(MAX_RAW_SQL + 1) }],
    ["a long title", { kind: "sql", sql: "select 1", title: "t".repeat(81) }],
    ["an unknown source", { kind: "peek", sql: "select 1" }],
    [
      "a match without a column",
      { kind: "match", schema: "public", table: "users", value: MATCH_VALUE },
    ],
    [
      "a match on a misclassified value",
      { ...MATCH, value: { kind: "integer", value: "abc" } },
    ],
  ])("rejects %s", (_label, source) => {
    expect(RunSqlParams.safeParse({ ...valid, source }).success).toBeFalsy();
  });
});
