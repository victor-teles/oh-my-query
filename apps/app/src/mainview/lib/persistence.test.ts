import { describe, expect, it } from "vitest";

import type { HistoryEntry, TabState } from "@/lib/persistence";

import {
  appendHistory,
  getAllHistory,
  getHistory,
  getTabs,
  saveTabs,
} from "@/lib/persistence";
import { mockTauri } from "@/test/tauri-mock";

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
  dialect: "postgresql",
  error: null,
  executionTimeMs: 5,
  sql: "SELECT 1",
  success: true,
  timestamp: new Date(Date.now()).toISOString(),
  ...overrides,
});

type TabsStore = Record<string, TabState>;

type HistoryStore = Record<string, HistoryEntry[]>;

const setupTabsMock = (): TabsStore => {
  const store: TabsStore = {};
  mockTauri({
    getTabs: (payload) => store[payload.connectionId as string] ?? null,
    saveTabs: (payload) => {
      store[payload.connectionId as string] = payload.state as TabState;
    },
  });
  return store;
};

const setupHistoryMock = (): HistoryStore => {
  const store: HistoryStore = {};
  mockTauri({
    appendHistory: (payload) => {
      const e = payload.entry as HistoryEntry;
      const list = store[e.connectionId] ?? [];
      list.unshift(e);
      store[e.connectionId] = list;
    },
    getAllHistory: () => Object.values(store).flat(),
    getHistory: (payload) => {
      const list = store[payload.connectionId as string] ?? [];
      const offset = (payload.offset as number | null) ?? 0;
      const limit = (payload.limit as number | null) ?? list.length;
      return list.slice(offset, offset + limit);
    },
  });
  return store;
};

describe("tabs persistence (RPC wrapper)", () => {
  it("forwards saveTabs and getTabs through the IPC client", async () => {
    setupTabsMock();
    await saveTabs("conn-1", tabState);
    await expect(getTabs("conn-1")).resolves.toStrictEqual(tabState);
  });

  it("returns null when the bun side has no tabs for the connection", async () => {
    setupTabsMock();
    await expect(getTabs("missing")).resolves.toBeNull();
  });
});

describe("history persistence (RPC wrapper)", () => {
  it("appends and reads entries via IPC in reverse chronological order", async () => {
    setupHistoryMock();
    await appendHistory(entry({ sql: "one" }));
    await appendHistory(entry({ sql: "two" }));

    const history = await getHistory("conn-1");
    expect(history.map((h) => h.sql)).toStrictEqual(["two", "one"]);
  });

  it("forwards limit/offset to the bun-side handler", async () => {
    setupHistoryMock();
    for (let i = 0; i < 10; i += 1) {
      await appendHistory(entry({ sql: `q${i}` }));
    }
    const page = await getHistory("conn-1", 3, 2);
    expect(page.map((h) => h.sql)).toStrictEqual(["q7", "q6", "q5"]);
  });

  it("returns an empty list when the connection has no history", async () => {
    setupHistoryMock();
    await expect(getHistory("missing")).resolves.toStrictEqual([]);
  });

  it("getAllHistory returns the full set across connections", async () => {
    setupHistoryMock();
    await appendHistory(entry({ connectionId: "a", sql: "one" }));
    await appendHistory(entry({ connectionId: "b", sql: "two" }));
    const all = await getAllHistory();
    expect(all.map((h) => h.sql).toSorted()).toStrictEqual(["one", "two"]);
  });
});
