import { describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";
import type { QueryTab } from "@/lib/query-types";

import { renderHook, waitFor } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

const fakeConnection: DatabaseConnection = {
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

const confirmMock = vi.fn(async (_sql: string) => {
  await Promise.resolve();
  return true;
});

vi.mock(import("@/contexts/connection-context"), () => ({
  useConnection: () => ({
    connection: fakeConnection,
    error: null,
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
    reconnect: vi.fn(),
    serverVersion: null,
  }),
}));

vi.mock(import("@/contexts/safe-mode-context"), () => ({
  useSafeMode: () => ({
    enabled: true,
    requestConfirmation: confirmMock,
    toggle: vi.fn(),
  }),
}));

const { useTabExecution } = await import("@/hooks/use-tab-execution");

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

const flushSave = vi.fn(async () => {
  await Promise.resolve();
});

describe("useTabExecution", () => {
  it("runs a successful query and updates the tab result", async () => {
    mockTauri({
      executeQuery: () => ({
        columns: [{ name: "one", typeName: "INT4" }],
        executionTimeMs: 2,
        isTruncated: false,
        resultType: "tabular",
        rowCount: 1,
        rows: [[1]],
      }),
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);

    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.execute("tab-1", "SELECT 1");

    await waitFor(() => expect(state.tabs[0]?.status).toBe("success"));
    const tabResult = state.tabs[0]?.result as
      | { resultType: "tabular"; rows: unknown[][] }
      | undefined;
    expect(tabResult?.resultType).toBe("tabular");
    expect(tabResult?.rows).toStrictEqual([[1]]);
    expect(state.tabs[0]?.runningQueryId).toBeNull();
  });

  it("reports errors from executeQuery", async () => {
    mockTauri({
      executeQuery: () => {
        throw Object.assign(new Error("syntax error"), { code: "42601" });
      },
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);

    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.execute("tab-1", "SELCT 1");

    await waitFor(() => expect(state.tabs[0]?.status).toBe("error"));
    expect(state.tabs[0]?.error).toBe("syntax error");
    expect(state.tabs[0]?.errorCode).toBe("42601");
  });

  it("treats QUERY_CANCELLED as idle, not an error", async () => {
    mockTauri({
      executeQuery: () => {
        throw Object.assign(new Error("cancelled"), {
          code: "QUERY_CANCELLED",
        });
      },
    });

    const { setTabs, state } = makeSetTabs([makeTab()]);

    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.execute("tab-1", "SELECT 1");

    await waitFor(() => expect(state.tabs[0]?.status).toBe("idle"));
    expect(state.tabs[0]?.error).toBeNull();
  });

  it("skips execution when safe mode blocks it", async () => {
    confirmMock.mockImplementationOnce(async (_sql: string) => {
      await Promise.resolve();
      return false;
    });
    const executeHandler = vi.fn();
    mockTauri({ executeQuery: executeHandler });

    const setTabs = vi.fn();
    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.execute("tab-1", "DROP TABLE users");

    expect(executeHandler).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
  });

  it("forwards connection name, type and environment to safe mode", async () => {
    confirmMock.mockClear();
    mockTauri({
      executeQuery: () => ({
        columns: [],
        executionTimeMs: 0,
        isTruncated: false,
        resultType: "tabular",
        rowCount: 0,
        rows: [],
      }),
    });

    const { setTabs } = makeSetTabs([makeTab()]);
    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs,
      })
    );

    await result.current.execute("tab-1", "SELECT 1");

    expect(confirmMock).toHaveBeenCalledWith("SELECT 1", {
      connectionName: "Local",
      connectionType: "postgresql",
      environment: undefined,
    });
  });

  it("forwards cancel() to cancel_query", async () => {
    const cancelHandler = vi.fn();
    mockTauri({ cancelQuery: cancelHandler });

    const { result } = renderHook(() =>
      useTabExecution({
        connectionId: "conn-1",
        flushSave,
        selectedDatabase: "public",
        setTabs: vi.fn(),
      })
    );

    await result.current.cancel("q-123");

    expect(cancelHandler).toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "q-123" })
    );
  });
});
