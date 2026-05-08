import { describe, expect, it, vi } from "vitest";

import type { QueryTab } from "@/lib/query-types";

import { renderHook } from "@/test/render-hook";

const setExecutionState = vi.fn();
const setCancelActive = vi.fn();
const cancelTab = vi.fn();
const setActiveSql = vi.fn();
const setExecutionSnapshot = vi.fn();
const setSelectedSql = vi.fn();
const setTabTitle = vi.fn();

vi.mock(import("@/contexts/query-execution-context"), () => ({
  useQueryExecution: (() => ({
    cancelActive: null,
    setCancelActive,
    setExecutionState,
    state: {
      error: null,
      result: null,
      startedAt: null,
      status: "idle",
    },
  })) as never,
}));

vi.mock(import("@/contexts/query-tabs-context"), () => ({
  useQueryTabsContext: (() => ({ cancelTab })) as never,
}));

vi.mock(import("@/contexts/active-query-context"), () => ({
  useActiveQuery: (() => ({
    getSnapshot: () => ({}),
    meta: {},
    setActiveSql,
    setExecutionSnapshot,
    setSelectedSql,
    setTabTitle,
  })) as never,
}));

const { useActiveQuerySync } = await import("@/hooks/use-active-query-sync");

const makeTab = (overrides: Partial<QueryTab> = {}): QueryTab => ({
  error: null,
  errorCode: null,
  executedSql: null,
  explainAnalyze: false,
  explainDensity: "comfortable",
  explainError: null,
  explainResult: null,
  explainSql: null,
  explainStatus: "idle",
  id: "tab-1",
  pendingExecution: null,
  result: null,
  runningExplainId: null,
  runningQueryId: null,
  sourceDialect: null,
  sql: "SELECT 1",
  status: "idle",
  title: "Query 1",
  ...overrides,
});

describe("useActiveQuerySync", () => {
  it("forwards SQL, title, and snapshot when an active tab is provided", () => {
    setActiveSql.mockClear();
    setTabTitle.mockClear();
    setSelectedSql.mockClear();
    setExecutionSnapshot.mockClear();

    renderHook(() => useActiveQuerySync(makeTab({ sql: "SELECT 42" })));

    expect(setActiveSql).toHaveBeenCalledWith("SELECT 42");
    expect(setTabTitle).toHaveBeenCalledWith("Query 1");
    expect(setSelectedSql).toHaveBeenCalledWith(null);
    expect(setExecutionSnapshot.mock.calls.length).toBeGreaterThan(0);
  });

  it("registers a cancel handler when running with a queryId", () => {
    setCancelActive.mockClear();
    renderHook(() =>
      useActiveQuerySync(makeTab({ runningQueryId: "q-1", status: "running" }))
    );
    expect(setCancelActive.mock.calls.length).toBeGreaterThan(0);
  });

  it("clears tab title and SQL when the active tab is undefined", () => {
    setActiveSql.mockClear();
    setTabTitle.mockClear();
    const noTab: QueryTab | undefined = undefined;
    renderHook(() => useActiveQuerySync(noTab));
    expect(setActiveSql).toHaveBeenCalledWith("");
    expect(setTabTitle).toHaveBeenCalledWith(null);
  });
});
