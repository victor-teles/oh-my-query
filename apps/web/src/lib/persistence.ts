import { safeGetJson, safeSetJson } from "@/lib/safe-storage";
import { isTauri } from "@/lib/tauri";

export interface PendingExecution {
  sql: string;
  database: string | null;
  sourceDialect: string | null;
  startedAt: string;
}

export interface PersistedTab {
  id: string;
  title: string;
  sql: string;
  sourceDialect: string | null;
  pendingExecution?: PendingExecution | null;
}

export interface TabState {
  tabs: PersistedTab[];
  activeTabId: string;
  counter: number;
}

export interface HistoryEntry {
  sql: string;
  connectionId: string;
  database: string | null;
  timestamp: string;
  success: boolean;
  error: string | null;
  executionTimeMs: number;
}

export const HISTORY_UPDATED_EVENT = "oh-my-query:history-updated";

const TABS_STORAGE_PREFIX = "oh-my-query-tabs-";
const HISTORY_STORAGE_PREFIX = "oh-my-query-history-";
const MAX_BROWSER_HISTORY = 500;

const isValidPersistedTab = (value: unknown): value is PersistedTab => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.sql === "string";
};

const isValidTabState = (value: unknown): value is TabState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.tabs) && typeof obj.activeTabId === "string";
};

const sanitizeTabState = (raw: TabState): TabState => {
  const validTabs = raw.tabs.filter(isValidPersistedTab);
  return {
    activeTabId: raw.activeTabId,
    counter:
      typeof raw.counter === "number" && raw.counter > 0
        ? raw.counter
        : validTabs.length,
    tabs: validTabs,
  };
};

const isValidHistoryEntry = (value: unknown): value is HistoryEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.sql === "string" && typeof obj.timestamp === "string";
};

export const getTabs = async (
  connectionId: string
): Promise<TabState | null> => {
  if (!isTauri()) {
    const parsed = safeGetJson<unknown>(
      `${TABS_STORAGE_PREFIX}${connectionId}`,
      null
    );
    if (!isValidTabState(parsed)) {
      return null;
    }
    return sanitizeTabState(parsed);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TabState | null>("get_tabs", { connectionId });
};

export const saveTabs = async (
  connectionId: string,
  state: TabState
): Promise<void> => {
  if (!isTauri()) {
    if (!safeSetJson(`${TABS_STORAGE_PREFIX}${connectionId}`, state)) {
      throw new StorageQuotaError();
    }
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_tabs", { connectionId, state });
};

export class StorageQuotaError extends Error {
  constructor() {
    super("localStorage quota exceeded");
    this.name = "StorageQuotaError";
  }
}

export const appendHistory = async (entry: HistoryEntry): Promise<void> => {
  if (!isTauri()) {
    const key = `${HISTORY_STORAGE_PREFIX}${entry.connectionId}`;
    const existing = safeGetJson<unknown[]>(key, []);
    const entries = existing.filter(isValidHistoryEntry);
    entries.push(entry);
    const trimmed = entries.slice(-MAX_BROWSER_HISTORY);
    safeSetJson(key, trimmed);
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("append_history", { entry });
};

export const getHistory = async (
  connectionId: string,
  limit?: number,
  offset?: number
): Promise<HistoryEntry[]> => {
  if (!isTauri()) {
    const raw = safeGetJson<unknown[]>(
      `${HISTORY_STORAGE_PREFIX}${connectionId}`,
      []
    );
    const entries = raw.filter(isValidHistoryEntry).toReversed();
    const start = offset ?? 0;
    return entries.slice(start, start + (limit ?? 100));
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HistoryEntry[]>("get_history", { connectionId, limit, offset });
};
