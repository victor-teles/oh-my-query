import { describe, expect, it } from "vitest";

import type { HistoryEntry, TabState } from "@/lib/persistence";

import {
  appendHistory,
  getHistory,
  getTabs,
  saveTabs,
} from "@/lib/persistence";

const tabState: TabState = {
  activeTabId: "t1",
  counter: 2,
  tabs: [
    { id: "t1", sourceDialect: null, sql: "SELECT 1", title: "A" },
    { id: "t2", sourceDialect: "mysql", sql: "SELECT 2", title: "B" },
  ],
};

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  connectionId: "conn-1",
  database: "public",
  error: null,
  executionTimeMs: 5,
  sql: "SELECT 1",
  success: true,
  timestamp: new Date(Date.now()).toISOString(),
  ...overrides,
});

describe("tabs persistence (browser mode)", () => {
  it("round-trips tabs through localStorage", async () => {
    await saveTabs("conn-1", tabState);
    const restored = await getTabs("conn-1");
    expect(restored).toStrictEqual(tabState);
  });

  it("returns null when nothing is stored", async () => {
    await expect(getTabs("missing")).resolves.toBeNull();
  });

  it("returns null when stored payload is invalid JSON", async () => {
    localStorage.setItem("oh-my-query-tabs-conn-1", "{oops");
    await expect(getTabs("conn-1")).resolves.toBeNull();
  });

  it("returns null when stored payload has the wrong shape", async () => {
    localStorage.setItem(
      "oh-my-query-tabs-conn-1",
      JSON.stringify({ tabs: "not-an-array" })
    );
    await expect(getTabs("conn-1")).resolves.toBeNull();
  });
});

describe("history persistence (browser mode)", () => {
  it("appends and returns entries in reverse chronological order", async () => {
    await appendHistory(entry({ sql: "one" }));
    await appendHistory(entry({ sql: "two" }));

    const history = await getHistory("conn-1");
    expect(history.map((h) => h.sql)).toStrictEqual(["two", "one"]);
  });

  it("limits and offsets results", async () => {
    for (let i = 0; i < 10; i += 1) {
      await appendHistory(entry({ sql: `q${i}` }));
    }
    const page = await getHistory("conn-1", 3, 2);
    expect(page.map((h) => h.sql)).toStrictEqual(["q7", "q6", "q5"]);
  });

  it("returns an empty list when nothing stored", async () => {
    await expect(getHistory("missing")).resolves.toStrictEqual([]);
  });

  it("caps stored entries at 500", async () => {
    for (let i = 0; i < 520; i += 1) {
      await appendHistory(entry({ sql: `q${i}` }));
    }
    const raw = localStorage.getItem("oh-my-query-history-conn-1") as string;
    const stored = JSON.parse(raw) as HistoryEntry[];
    expect(stored).toHaveLength(500);
    expect(stored[0]?.sql).toBe("q20");
    expect(stored[499]?.sql).toBe("q519");
  });
});
