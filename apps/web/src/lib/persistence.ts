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

const safeParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const isValidTabState = (value: unknown): value is TabState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.tabs) && typeof obj.activeTabId === "string";
};

export const getTabs = async (
  connectionId: string
): Promise<TabState | null> => {
  if (!isTauri()) {
    const raw = localStorage.getItem(`${TABS_STORAGE_PREFIX}${connectionId}`);
    if (!raw) {
      return null;
    }
    const parsed = safeParse<unknown>(raw, null);
    return isValidTabState(parsed) ? parsed : null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TabState | null>("get_tabs", { connectionId });
};

export const saveTabs = async (
  connectionId: string,
  state: TabState
): Promise<void> => {
  if (!isTauri()) {
    localStorage.setItem(
      `${TABS_STORAGE_PREFIX}${connectionId}`,
      JSON.stringify(state)
    );
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_tabs", { connectionId, state });
};

export const appendHistory = async (entry: HistoryEntry): Promise<void> => {
  if (!isTauri()) {
    const key = `${HISTORY_STORAGE_PREFIX}${entry.connectionId}`;
    const raw = localStorage.getItem(key);
    const entries = raw ? safeParse<HistoryEntry[]>(raw, []) : [];
    entries.push(entry);
    const trimmed = entries.slice(-MAX_BROWSER_HISTORY);
    localStorage.setItem(key, JSON.stringify(trimmed));
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
    const raw = localStorage.getItem(
      `${HISTORY_STORAGE_PREFIX}${connectionId}`
    );
    if (!raw) {
      return [];
    }
    const entries = safeParse<HistoryEntry[]>(raw, []).toReversed();
    const start = offset ?? 0;
    return entries.slice(start, start + (limit ?? 100));
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HistoryEntry[]>("get_history", { connectionId, limit, offset });
};
