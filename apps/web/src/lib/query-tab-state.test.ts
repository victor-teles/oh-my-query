import { describe, expect, it } from "vitest";

import type { TabState } from "@/lib/persistence";

import {
  createNewQueryTab,
  restoreQueryTabState,
} from "@/lib/query-tab-state";

describe("restoreQueryTabState", () => {
  it("keeps the saved active tab when it still exists", () => {
    const saved: TabState = {
      activeTabId: "tab-2",
      counter: 4,
      tabs: [
        { id: "tab-1", title: "Query 1", sql: "select 1", sourceDialect: null },
        {
          id: "tab-2",
          title: "Query 2",
          sql: "select 2",
          sourceDialect: "postgresql",
        },
      ],
    };

    const restored = restoreQueryTabState(saved);

    expect(restored.activeTabId).toBe("tab-2");
    expect(restored.counter).toBe(4);
    expect(restored.tabs).toHaveLength(2);
  });

  it("falls back to the first restored tab when the saved active tab is missing", () => {
    const saved: TabState = {
      activeTabId: "missing",
      counter: 2,
      tabs: [
        { id: "tab-9", title: "Query 9", sql: "select 9", sourceDialect: null },
      ],
    };

    const restored = restoreQueryTabState(saved);

    expect(restored.activeTabId).toBe("tab-9");
    expect(restored.counter).toBe(2);
  });

  it("creates a fresh tab when there is no usable saved state", () => {
    const restored = restoreQueryTabState(null, () => "generated-tab-id");

    expect(restored.activeTabId).toBe("generated-tab-id");
    expect(restored.counter).toBe(1);
    expect(restored.tabs).toEqual([
      {
        error: null,
        executedSql: null,
        id: "generated-tab-id",
        result: null,
        sourceDialect: null,
        sql: "",
        status: "idle",
        title: "Query 1",
      },
    ]);
  });
});

describe("createNewQueryTab", () => {
  it("creates an idle query tab with a predictable title", () => {
    expect(createNewQueryTab(3, () => "tab-3")).toEqual({
      error: null,
      executedSql: null,
      id: "tab-3",
      result: null,
      sourceDialect: null,
      sql: "",
      status: "idle",
      title: "Query 3",
    });
  });
});
