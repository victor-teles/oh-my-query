import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";

import { renderHook, waitFor } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

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

vi.mock(import("@/contexts/safe-mode-context"), () => ({
  useSafeMode: () => ({
    enabled: false,
    requestConfirmation: async () => {
      await Promise.resolve();
      return true;
    },
    toggle: vi.fn(),
  }),
}));

const { useQueryTabs } = await import("@/hooks/use-query-tabs");

describe("useQueryTabs", () => {
  beforeEach(() => {
    mockTauri({
      executeQuery: () => ({
        columns: [],
        executionTimeMs: 0,
        isTruncated: false,
        resultType: "tabular",
        rowCount: 0,
        rows: [],
      }),
      getTabs: () => null,
      saveTabs: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates with one default tab on a fresh connection", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(result.current.tabs[0]?.id);
    expect(result.current.activeTab?.title).toBe("Query 1");
  });

  it("addTab appends a new tab and selects it", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());

    act(() => {
      result.current.addTab();
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTabId).toBe(result.current.tabs[1]?.id);
    expect(result.current.tabs[1]?.title).toBe("Query 2");
  });

  it("addTabWithSql seeds the new tab's sql", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());

    act(() => {
      result.current.addTabWithSql("SELECT 42");
    });

    expect(result.current.tabs[1]?.sql).toBe("SELECT 42");
  });

  it("updateTabSql edits a tab's sql", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    const { id } = result.current.tabs[0] as { id: string };

    act(() => {
      result.current.updateTabSql(id, "SELECT 1");
    });
    expect(result.current.tabs[0]?.sql).toBe("SELECT 1");
  });

  it("updateTabDialect sets sourceDialect", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    const { id } = result.current.tabs[0] as { id: string };

    act(() => {
      result.current.updateTabDialect(id, "mysql");
    });
    expect(result.current.tabs[0]?.sourceDialect).toBe("mysql");
  });

  it("closeTab removes a tab and reopenTab restores it", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());

    act(() => {
      result.current.addTab();
    });
    const closingId = (result.current.tabs[1] as { id: string }).id;

    act(() => {
      result.current.closeTab(closingId);
    });
    expect(result.current.tabs).toHaveLength(1);

    act(() => {
      result.current.reopenTab();
    });
    expect(result.current.tabs.some((t) => t.id === closingId)).toBeTruthy();
  });

  it("closeTab on the last tab creates a fresh empty tab", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    const onlyId = (result.current.tabs[0] as { id: string }).id;

    act(() => {
      result.current.closeTab(onlyId);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.id).not.toBe(onlyId);
  });

  it("reorderTabs accepts a permutation and rejects mismatched length", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());

    act(() => {
      result.current.addTab();
    });
    const [a, b] = result.current.tabs.map((t) => t.id);

    act(() => {
      result.current.reorderTabs([b as string, a as string]);
    });
    expect(result.current.tabs.map((t) => t.id)).toStrictEqual([b, a]);

    act(() => {
      result.current.reorderTabs([a as string]);
    });
    // Length mismatch — order unchanged
    expect(result.current.tabs.map((t) => t.id)).toStrictEqual([b, a]);
  });

  it("setExplainAnalyze and setExplainDensity update flags", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    const { id } = result.current.tabs[0] as { id: string };

    act(() => {
      result.current.setExplainAnalyze(id, true);
      result.current.setExplainDensity(id, "compact");
    });
    expect(result.current.tabs[0]?.explainAnalyze).toBeTruthy();
    expect(result.current.tabs[0]?.explainDensity).toBe("compact");
  });

  it("executeTab no-ops when sql is blank", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());

    const { id } = result.current.tabs[0] as { id: string };
    act(() => {
      result.current.executeTab(id);
    });
    // No status change — still idle
    expect(result.current.tabs[0]?.status).toBe("idle");
  });

  it("addTabWithSqlAndRun replaces an empty active tab in place", async () => {
    const { result } = renderHook(() => useQueryTabs("conn-1", "public"));
    await waitFor(() => expect(result.current.isRestored).toBeTruthy());
    const initialId = result.current.tabs[0]?.id;

    act(() => {
      result.current.addTabWithSqlAndRun("SELECT 1");
    });

    // SQL applied to the existing empty tab; no new tab added.
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.id).toBe(initialId);
    expect(result.current.tabs[0]?.sql).toBe("SELECT 1");
  });
});
