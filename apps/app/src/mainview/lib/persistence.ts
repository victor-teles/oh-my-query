import type {
  HistoryEntry,
  HistoryFilters,
  PersistedTab as IpcPersistedTab,
} from "@/lib/ipc";

// Persistence is fully handled by the Bun main process via Electrobun RPC.
// This module re-exports the typed wrappers from `@/lib/ipc` and keeps the
// extra UI-side `PendingExecution` type that lives only in the renderer.
import {
  appendHistory as ipcAppendHistory,
  getAllHistory as ipcGetAllHistory,
  getHistory as ipcGetHistory,
  getTabs as ipcGetTabs,
  saveTabs as ipcSaveTabs,
} from "@/lib/ipc";

export type { HistoryEntry, HistoryFilters };

export interface PendingExecution {
  sql: string;
  database: string | null;
  sourceDialect: string | null;
  startedAt: string;
}

export interface PersistedTab extends IpcPersistedTab {
  pendingExecution?: PendingExecution | null;
}

export interface TabState {
  tabs: PersistedTab[];
  activeTabId: string;
  counter: number;
}

export const HISTORY_UPDATED_EVENT = "oh-my-query:history-updated";

export const getTabs = (connectionId: string): Promise<TabState | null> =>
  ipcGetTabs(connectionId) as Promise<TabState | null>;

export const saveTabs = (
  connectionId: string,
  state: TabState
): Promise<void> => ipcSaveTabs(connectionId, state);

export const appendHistory = (entry: HistoryEntry): Promise<void> =>
  ipcAppendHistory(entry);

export const getHistory = (
  connectionId: string,
  limit?: number,
  offset?: number
): Promise<HistoryEntry[]> =>
  ipcGetHistory(connectionId, limit ?? null, offset ?? null);

export const getAllHistory = (
  filters: HistoryFilters = {}
): Promise<HistoryEntry[]> => ipcGetAllHistory(filters);
