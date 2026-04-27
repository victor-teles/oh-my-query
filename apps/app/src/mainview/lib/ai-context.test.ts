import { describe, expect, it } from "vitest";

import type { ActiveQuerySnapshot } from "@/contexts/active-query-context";
import type { ExecuteResult } from "@/lib/tauri";

import {
  formatActiveQueryContext,
  hasMeaningfulContext,
} from "@/lib/ai-context";

const baseSnapshot: ActiveQuerySnapshot = {
  activeSql: "",
  error: null,
  errorCode: null,
  executedSql: null,
  result: null,
  runningSql: null,
  selectedSql: null,
  status: "idle",
  tabTitle: null,
};

const tabular = (
  overrides: Partial<Extract<ExecuteResult, { resultType: "tabular" }>> = {}
): ExecuteResult => ({
  columns: [
    { name: "id", typeName: "int4" },
    { name: "name", typeName: "text" },
  ],
  executionTimeMs: 12,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 2,
  rows: [
    [1, "alice"],
    [2, "bob"],
  ],
  ...overrides,
});

const docs = (
  overrides: Partial<Extract<ExecuteResult, { resultType: "documents" }>> = {}
): ExecuteResult => ({
  count: 1,
  documents: [{ _id: "a", value: 1 }],
  executionTimeMs: 7,
  isTruncated: false,
  resultType: "documents",
  ...overrides,
});

describe("hasMeaningfulContext", () => {
  it("returns false for the empty snapshot", () => {
    expect(hasMeaningfulContext(baseSnapshot)).toBeFalsy();
  });

  it("returns true when activeSql is present", () => {
    expect(
      hasMeaningfulContext({ ...baseSnapshot, activeSql: "SELECT 1" })
    ).toBeTruthy();
  });

  it("returns true when there is a result", () => {
    expect(
      hasMeaningfulContext({ ...baseSnapshot, result: tabular() })
    ).toBeTruthy();
  });

  it("returns true when there is an error", () => {
    expect(
      hasMeaningfulContext({ ...baseSnapshot, error: "syntax error" })
    ).toBeTruthy();
  });

  it("ignores whitespace-only sql values", () => {
    expect(
      hasMeaningfulContext({ ...baseSnapshot, activeSql: "   \n  " })
    ).toBeFalsy();
  });
});

describe("formatActiveQueryContext — gating", () => {
  it("returns null when nothing meaningful is present", () => {
    expect(formatActiveQueryContext(baseSnapshot)).toBeNull();
  });
});

describe("formatActiveQueryContext — sections", () => {
  it("includes the tab title and status", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT 1",
      status: "success",
      tabTitle: "Query 1",
    });
    expect(out).toContain("Active tab: Query 1");
    expect(out).toContain("Status: success");
    expect(out).toContain("Active query");
    expect(out).toContain("```sql\nSELECT 1\n```");
  });

  it("includes a selected text section", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT * FROM users",
      selectedSql: "WHERE id = 1",
      status: "idle",
    });
    expect(out).toContain("Selected text");
    expect(out).toContain("WHERE id = 1");
  });

  it("shows the running query section only when running and distinct", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT 2",
      runningSql: "SELECT 1",
      status: "running",
    });
    expect(out).toContain("Running query");
    expect(out).toContain("```sql\nSELECT 1\n```");
  });

  it("does not duplicate executed query when same as active", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT 1",
      executedSql: "SELECT 1",
      status: "success",
    });
    expect(out).not.toContain("Last executed query:");
  });

  it("renders tabular result preview with header, divider, and rows", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT id, name FROM users",
      result: tabular(),
      status: "success",
    });
    expect(out).toContain("Last result: 2 rows");
    expect(out).toContain("Columns: id (int4), name (text)");
    expect(out).toContain("| id | name |");
    expect(out).toContain("| --- | --- |");
    expect(out).toMatch(/\| 1 \| alice \|.*\| 2 \| bob \|/s);
  });

  it("flags truncation and pluralizes singular row count", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT 1",
      result: tabular({
        isTruncated: true,
        rowCount: 1,
        rows: [[1, "alice"]],
      }),
      status: "success",
    });
    expect(out).toContain("1 row in 12ms (truncated by engine)");
  });

  it("notes when there are more rows than shown", () => {
    const big = tabular({
      rowCount: 12,
      rows: [
        [1, "a"],
        [2, "b"],
        [3, "c"],
        [4, "d"],
        [5, "e"],
        [6, "f"],
      ],
    });
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT *",
      result: big,
      status: "success",
    });
    expect(out).toContain("Preview (first 5 of 12)");
    expect(out).toContain("… and 7 more rows not shown");
  });

  it("renders empty tabular results with a (no rows returned) marker", () => {
    const empty = tabular({ rowCount: 0, rows: [] });
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT *",
      result: empty,
      status: "success",
    });
    expect(out).toContain("(no rows returned)");
  });

  it("renders document results with json previews", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "find()",
      result: docs(),
      status: "success",
    });
    expect(out).toContain("1 document");
    expect(out).toContain('"_id":"a"');
  });

  it("renders empty document results with an empty marker", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "find()",
      result: docs({ count: 0, documents: [] }),
      status: "success",
    });
    expect(out).toContain("(no documents returned)");
  });

  it("renders error context with a label", () => {
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: "SELECT bad",
      error: 'column "bad" does not exist',
      errorCode: "42703",
      status: "error",
    });
    expect(out).toContain("Last error");
    expect(out).toContain('column "bad" does not exist');
  });

  it("truncates very long active SQL", () => {
    const huge = "SELECT 1".padEnd(2500, " /* x */");
    const out = formatActiveQueryContext({
      ...baseSnapshot,
      activeSql: huge,
      status: "idle",
    });
    expect(out).toContain("[truncated]");
  });
});
