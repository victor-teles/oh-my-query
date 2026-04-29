import { describe, expect, it } from "vitest";

import type { ExplainResult, PlanNode } from "@/lib/tauri";

import { composeActionMessage } from "@/lib/ai-actions";

const makePlanNode = (overrides: Partial<PlanNode> = {}): PlanNode => ({
  children: [],
  cost: { actualTotalMs: null, selfMs: null, startup: null, total: null },
  details: [],
  id: "root",
  label: "Seq Scan on users",
  nodeType: "Seq Scan",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: null, loops: null, startupMs: null },
  warnings: [],
  ...overrides,
});

const makeExplainResult = (
  overrides: Partial<ExplainResult> = {}
): ExplainResult => ({
  analyzeRan: false,
  engine: "postgresql",
  executionTimeMs: 42,
  raw: "Seq Scan on users",
  root: makePlanNode(),
  supportsAnalyze: true,
  ...overrides,
});

describe("composeActionMessage — explain", () => {
  it("returns null when sql is empty", () => {
    expect(composeActionMessage({ sql: "  ", type: "explain" })).toBeNull();
  });

  it("frames whole-query explanations as 'this SQL query'", () => {
    const msg = composeActionMessage({
      sql: "SELECT 1",
      type: "explain",
    });
    expect(msg).toContain("Explain this SQL query");
    expect(msg).toContain("```sql\nSELECT 1\n```");
  });

  it("frames selection explanations as 'the highlighted selection'", () => {
    const msg = composeActionMessage({
      isSelection: true,
      sql: "WHERE 1=1",
      type: "explain",
    });
    expect(msg).toContain("the highlighted selection");
  });
});

describe("composeActionMessage — fix", () => {
  it("returns null when both sql and error are empty", () => {
    expect(composeActionMessage({ type: "fix" })).toBeNull();
  });

  it("includes the error and a hint for permission errors", () => {
    const msg = composeActionMessage({
      error: "permission denied for table users",
      errorCode: "42501",
      sql: "SELECT * FROM users",
      type: "fix",
    });
    expect(msg).toContain("Diagnose the cause");
    expect(msg).toContain("Error: permission denied for table users");
    expect(msg).toContain("Likely cause:");
    expect(msg).toContain("```sql\nSELECT * FROM users\n```");
  });

  it("falls back to a generic review when no error is provided", () => {
    const msg = composeActionMessage({
      sql: "SELECT *",
      type: "fix",
    });
    expect(msg).toContain("Review this SQL query");
    expect(msg).toContain("```sql\nSELECT *\n```");
  });

  it("works with only an error (no sql)", () => {
    const msg = composeActionMessage({
      error: "syntax error",
      errorCode: null,
      type: "fix",
    });
    expect(msg).toContain("Error: syntax error");
    expect(msg).not.toContain("```sql");
  });
});

describe("composeActionMessage — improve-plan", () => {
  it("returns null when plan is missing", () => {
    expect(
      composeActionMessage({ sql: "SELECT 1", type: "improve-plan" })
    ).toBeNull();
  });

  it("returns null when sql is empty", () => {
    expect(
      composeActionMessage({
        plan: makeExplainResult(),
        sql: "  ",
        type: "improve-plan",
      })
    ).toBeNull();
  });

  it("includes the plan summary, the SQL fence, and a task directive", () => {
    const sql = "SELECT id FROM orders WHERE status = 'open'";
    const msg = composeActionMessage({
      plan: makeExplainResult(),
      sql,
      type: "improve-plan",
    });
    expect(msg).toContain("Engine: postgresql");
    expect(msg).toContain(sql);
    expect(msg).toContain("## Task");
    expect(msg).toContain("Diagnose the bottleneck");
  });
});

describe("composeActionMessage — generate and unknown", () => {
  it("returns null for generate (handled elsewhere)", () => {
    expect(composeActionMessage({ type: "generate" })).toBeNull();
  });

  it("returns null for unknown action types", () => {
    expect(
      composeActionMessage({
        type: "noop" as unknown as "explain",
      })
    ).toBeNull();
  });
});
