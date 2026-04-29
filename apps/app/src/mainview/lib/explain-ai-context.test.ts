import { describe, expect, it } from "vitest";

import type { ExplainResult, PlanNode } from "@/lib/tauri";

import { formatExplainContext } from "./explain-ai-context";

const makeNode = (overrides: Partial<PlanNode> = {}): PlanNode => ({
  children: [],
  cost: { actualTotalMs: null, selfMs: null, startup: null, total: null },
  details: [],
  id: "n",
  label: "Seq Scan on users",
  nodeType: "Seq Scan",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: null, loops: null, startupMs: null },
  warnings: [],
  ...overrides,
});

const makeResult = (overrides: Partial<ExplainResult> = {}): ExplainResult => ({
  analyzeRan: false,
  engine: "postgresql",
  executionTimeMs: 42,
  raw: "Seq Scan on users",
  root: makeNode({ id: "root" }),
  supportsAnalyze: true,
  ...overrides,
});

describe("formatExplainContext", () => {
  it("includes engine and mode", () => {
    const ctx = formatExplainContext(makeResult(), "SELECT 1");
    expect(ctx).toContain("Engine: postgresql");
    expect(ctx).toContain("estimated costs only");
  });

  it("marks ANALYZE mode when ran", () => {
    const ctx = formatExplainContext(
      makeResult({ analyzeRan: true }),
      "SELECT 1"
    );
    expect(ctx).toContain("actual timings");
  });

  it("includes the SQL verbatim", () => {
    const sql = "SELECT id FROM orders WHERE status = 'open'";
    const ctx = formatExplainContext(makeResult(), sql);
    expect(ctx).toContain(sql);
  });

  it("includes the execution time", () => {
    const ctx = formatExplainContext(
      makeResult({ executionTimeMs: 123.45 }),
      "SELECT 1"
    );
    expect(ctx).toContain("123.45ms");
  });

  it("lists hot-path nodes with actual timing", () => {
    const root = makeNode({
      children: [
        makeNode({
          cost: { actualTotalMs: 5, selfMs: 5, startup: null, total: null },
          id: "child-fast",
          label: "fast",
        }),
        makeNode({
          cost: { actualTotalMs: 30, selfMs: 30, startup: null, total: null },
          id: "child-slow",
          label: "slow_scan",
        }),
      ],
      cost: { actualTotalMs: 35, selfMs: 0, startup: null, total: null },
      id: "root",
    });
    const ctx = formatExplainContext(makeResult({ root }), "SELECT 1");
    expect(ctx).toContain("slow_scan");
    expect(ctx).toContain("[hot-path]");
  });

  it("surfaces warnings in a dedicated section", () => {
    const root = makeNode({
      id: "root",
      warnings: ["sequential scan on large table"],
    });
    const ctx = formatExplainContext(makeResult({ root }), "SELECT 1");
    expect(ctx).toContain("Nodes with warnings");
    expect(ctx).toContain("sequential scan on large table");
  });

  it("notes row estimate mismatch when off by 10x", () => {
    const root = makeNode({
      cost: { actualTotalMs: 10, selfMs: 10, startup: null, total: null },
      id: "root",
      rows: { actual: 10_000, estimated: 1 },
    });
    const ctx = formatExplainContext(makeResult({ root }), "SELECT 1");
    expect(ctx).toContain("10×");
  });
});
