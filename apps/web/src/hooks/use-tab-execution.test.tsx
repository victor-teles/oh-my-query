import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";
import type { QueryTab } from "@/lib/query-types";

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

const autoConfirm = vi.fn(async () => true);
const blockConfirm = vi.fn(async () => false);
let currentConfirm = autoConfirm;

vi.mock<typeof import("@/contexts/connection-context")>(
  "@/contexts/connection-context",
  () => ({
    useConnection: () => ({ connection: fakeConnection }),
  })
);

vi.mock<typeof import("@/contexts/safe-mode-context")>(
  "@/contexts/safe-mode-context",
  () => ({
    useSafeMode: () => ({
      enabled: true,
      requestConfirmation: (sql: string) => currentConfirm(sql),
      toggle: () => {},
    }),
  })
);

const { useTabExecution } = await import("@/hooks/use-tab-execution");

const makeTab = (overrides: Partial<QueryTab> = {}): QueryTab => ({
  error: null,
  errorCode: null,
  executedSql: null,
  id: "tab-1",
  pendingExecution: null,
  result: null,
  runningQueryId: null,
  sql: "SELECT 1",
  status: "idle",
  title: "Query 1",
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

describe("useTabExecution", () => {
  it("runs a successful query and updates the tab result", async () => {
    currentConfirm = autoConfirm;
    mockTauri({
      execute_query: () => ({
        columns: [{ name: "one", typeName: "INT4" }],
        executionTimeMs: 2,
        isTruncated: false,
        resultType: "tabular",
        rowCount: 1,
        rows: [[1]],
      }),
    });

    let tabs: QueryTab[] = [makeTab()];
    const setTabs = vi.fn((update) => {
      tabs =
        typeof update === "function"
          ? (update as (prev: QueryTab[]) => QueryTab[])(tabs)
          : update;
    });

    const { result } = renderHook(
      () =>
        useTabExecution({
          connectionId: "conn-1",
          flushSave: async () => {},
          selectedDatabase: "public",
          setTabs,
        }),
      { wrapper }
    );

    await result.current.execute("tab-1", "SELECT 1");

    await waitFor(() => expect(tabs[0]?.status).toBe("success"));
    expect(tabs[0]?.result?.rows).toStrictEqual([[1]]);
    expect(tabs[0]?.runningQueryId).toBeNull();
  });

  it("reports errors from executeQuery", async () => {
    currentConfirm = autoConfirm;
    mockTauri({
      execute_query: () => {
        throw { code: "42601", message: "syntax error" };
      },
    });

    let tabs: QueryTab[] = [makeTab()];
    const setTabs = vi.fn((update) => {
      tabs =
        typeof update === "function"
          ? (update as (prev: QueryTab[]) => QueryTab[])(tabs)
          : update;
    });

    const { result } = renderHook(
      () =>
        useTabExecution({
          connectionId: "conn-1",
          flushSave: async () => {},
          selectedDatabase: "public",
          setTabs,
        }),
      { wrapper }
    );

    await result.current.execute("tab-1", "SELCT 1");

    await waitFor(() => expect(tabs[0]?.status).toBe("error"));
    expect(tabs[0]?.error).toBe("syntax error");
    expect(tabs[0]?.errorCode).toBe("42601");
  });

  it("treats QUERY_CANCELLED as idle, not an error", async () => {
    currentConfirm = autoConfirm;
    mockTauri({
      execute_query: () => {
        throw { code: "QUERY_CANCELLED", message: "cancelled" };
      },
    });

    let tabs: QueryTab[] = [makeTab()];
    const setTabs = vi.fn((update) => {
      tabs =
        typeof update === "function"
          ? (update as (prev: QueryTab[]) => QueryTab[])(tabs)
          : update;
    });

    const { result } = renderHook(
      () =>
        useTabExecution({
          connectionId: "conn-1",
          flushSave: async () => {},
          selectedDatabase: "public",
          setTabs,
        }),
      { wrapper }
    );

    await result.current.execute("tab-1", "SELECT 1");

    await waitFor(() => expect(tabs[0]?.status).toBe("idle"));
    expect(tabs[0]?.error).toBeNull();
  });

  it("skips execution when safe mode blocks it", async () => {
    currentConfirm = blockConfirm;
    const executeHandler = vi.fn();
    mockTauri({ execute_query: executeHandler });

    const setTabs = vi.fn();
    const { result } = renderHook(
      () =>
        useTabExecution({
          connectionId: "conn-1",
          flushSave: async () => {},
          selectedDatabase: "public",
          setTabs,
        }),
      { wrapper }
    );

    await result.current.execute("tab-1", "DROP TABLE users");

    expect(executeHandler).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
  });

  it("forwards cancel() to cancel_query", async () => {
    currentConfirm = autoConfirm;
    const cancelHandler = vi.fn();
    mockTauri({ cancel_query: cancelHandler });

    const { result } = renderHook(
      () =>
        useTabExecution({
          connectionId: "conn-1",
          flushSave: async () => {},
          selectedDatabase: "public",
          setTabs: vi.fn(),
        }),
      { wrapper }
    );

    await result.current.cancel("q-123");

    expect(cancelHandler).toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "q-123" })
    );
  });
});
