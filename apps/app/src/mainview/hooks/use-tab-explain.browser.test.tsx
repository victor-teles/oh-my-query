import { describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";
import type { QueryTab } from "@/lib/query-types";
import type { ExplainResult, PlanNode } from "@/lib/tauri";

import { renderHook, waitFor } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

const makePlanNode = (overrides: Partial<PlanNode> = {}): PlanNode => ({
  children: [],
  cost: { actualTotalMs: null, selfMs: null, startup: null, total: null },
  details: [],
  id: "n0",
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
  executionTimeMs: 0,
  raw: "",
  root: makePlanNode(),
  supportsAnalyze: true,
  ...overrides,
});

const baseConnection: DatabaseConnection = {
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: "conn-1",
  lastConnectedAt: null,
  name: "Local",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
};

vi.mock(import("@/contexts/connection-context"), async () => {
  const { resolveRunConfig } = await import("@/lib/connections");
  return {
    useConnection: () => ({
      connection: baseConnection,
      error: null,
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      reconnect: vi.fn(),
      runConfig: resolveRunConfig(baseConnection),
      serverVersion: null,
      setRunConfig: vi.fn(),
    }),
  };
});

const { useTabExplain } = await import("@/hooks/use-tab-explain");

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

const applyUpdate = <T,>(prev: T[], update: T[] | ((p: T[]) => T[])): T[] =>
  typeof update === "function" ? update(prev) : update;

const makeSetTabs = (initial: QueryTab[]) => {
  const state = { tabs: initial };
  const setTabs = vi.fn(
    (update: QueryTab[] | ((prev: QueryTab[]) => QueryTab[])) => {
      state.tabs = applyUpdate(state.tabs, update);
    }
  );
  return { setTabs, state };
};

describe("useTabExplain", () => {
  it("captures a successful EXPLAIN result", async () => {
    mockTauri({
      explainQuery: () =>
        makeExplainResult({ executionTimeMs: 1, raw: "Seq Scan on users" }),
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);
    const { result } = renderHook(() =>
      useTabExplain({
        connectionId: "conn-1",
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.explain("tab-1", "SELECT 1", null, false);

    await waitFor(() => expect(state.tabs[0]?.explainStatus).toBe("success"));
    expect(state.tabs[0]?.explainSql).toBe("SELECT 1");
    expect(state.tabs[0]?.explainError).toBeNull();
    expect(state.tabs[0]?.runningExplainId).toBeNull();
  });

  it("records error message when EXPLAIN fails", async () => {
    mockTauri({
      explainQuery: () => {
        throw Object.assign(new Error("plan failed"), { code: "42P01" });
      },
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);
    const { result } = renderHook(() =>
      useTabExplain({
        connectionId: "conn-1",
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.explain("tab-1", "SELECT 1", null, false);

    await waitFor(() => expect(state.tabs[0]?.explainStatus).toBe("error"));
    expect(state.tabs[0]?.explainError).toBe("plan failed");
  });

  it("treats QUERY_CANCELLED as idle without an error", async () => {
    mockTauri({
      explainQuery: () => {
        throw Object.assign(new Error("cancelled"), {
          code: "QUERY_CANCELLED",
        });
      },
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);
    const { result } = renderHook(() =>
      useTabExplain({
        connectionId: "conn-1",
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.explain("tab-1", "SELECT 1", null, false);

    await waitFor(() => expect(state.tabs[0]?.explainStatus).toBe("idle"));
    expect(state.tabs[0]?.explainError).toBeNull();
  });

  it("forwards cancel() to cancelQuery RPC", async () => {
    const cancel = vi.fn();
    mockTauri({ cancelQuery: cancel });

    const { result } = renderHook(() =>
      useTabExplain({
        connectionId: "conn-1",
        selectedDatabase: null,
        setTabs: vi.fn(),
      })
    );

    await result.current.cancel("q-explain");
    expect(cancel).toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "q-explain" })
    );
  });

  it("forwards analyze and dialect to explainQuery", async () => {
    const calls: Record<string, unknown>[] = [];
    mockTauri({
      explainQuery: (payload) => {
        calls.push(payload);
        return makeExplainResult({
          analyzeRan: true,
          root: makePlanNode({ id: "n0", label: "Result", nodeType: "Result" }),
        });
      },
    });

    const { setTabs } = makeSetTabs([makeTab()]);
    const { result } = renderHook(() =>
      useTabExplain({
        connectionId: "conn-1",
        selectedDatabase: "analytics",
        setTabs,
      })
    );

    await result.current.explain("tab-1", "SELECT 2", "mysql", true);

    expect(calls[0]).toMatchObject({
      params: {
        analyze: true,
        connectionId: "conn-1",
        schema: "analytics",
        sourceDialect: "mysql",
        sql: "SELECT 2",
      },
    });
  });
});
