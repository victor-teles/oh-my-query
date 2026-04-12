import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { PersistedTab, TabState } from "@/lib/persistence";
import type { QueryTab } from "@/lib/query-types";

import { getTabs, saveTabs } from "@/lib/persistence";
import {
  createNewQueryTab,
  isTabDirty,
  restoreQueryTabState,
} from "@/lib/query-tab-state";
import { isTauri } from "@/lib/tauri";

import { useTabExecution } from "./use-tab-execution";

const SAVE_DEBOUNCE_MS = 150;
const SAVE_ERROR_TOAST_THROTTLE_MS = 10_000;
const MAX_CLOSED_TABS = 5;
const DESTRUCTIVE_SQL_PATTERN =
  /^\s*(insert|update|delete|drop|truncate|alter|create|grant|revoke|merge|replace)\b/i;

const toPersistedTab = (tab: QueryTab): PersistedTab => ({
  id: tab.id,
  pendingExecution: tab.pendingExecution,
  sourceDialect: tab.sourceDialect,
  sql: tab.sql,
  title: tab.title,
});

export const useQueryTabs = (
  connectionId: string,
  selectedDatabase: string | null
) => {
  const counterRef = useRef(1);
  const [tabs, setTabs] = useState<QueryTab[]>(() => [
    createNewQueryTab(counterRef.current),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id ?? ""
  );
  const [isRestored, setIsRestored] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveErrorToastRef = useRef(0);
  const autoResumedRef = useRef(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const connectionIdRef = useRef(connectionId);
  connectionIdRef.current = connectionId;
  const closedTabsRef = useRef<{ tab: QueryTab; index: number }[]>([]);

  const runSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const state: TabState = {
      activeTabId: activeTabIdRef.current,
      counter: counterRef.current,
      tabs: tabsRef.current.map(toPersistedTab),
    };
    try {
      await saveTabs(connectionIdRef.current, state);
    } catch {
      const now = Date.now();
      if (now - lastSaveErrorToastRef.current > SAVE_ERROR_TOAST_THROTTLE_MS) {
        lastSaveErrorToastRef.current = now;
        toast.error("Couldn't save your tabs", {
          description:
            "Your recent edits may not survive a restart. Check disk space and permissions.",
        });
      }
    }
  }, []);

  const flushSave = useCallback(async () => {
    if (!isRestored) {
      return;
    }
    await runSave();
  }, [isRestored, runSave]);

  const { cancel, execute } = useTabExecution({
    connectionId,
    flushSave,
    selectedDatabase,
    setTabs,
  });

  useEffect(() => {
    autoResumedRef.current = false;
    setIsRestored(false);
    const restore = async () => {
      try {
        const restored = restoreQueryTabState(await getTabs(connectionId));
        counterRef.current = restored.counter;
        setTabs(restored.tabs);
        setActiveTabId(restored.activeTabId);
      } catch {
        // Fall back to default tab on restore failure
      } finally {
        setIsRestored(true);
      }
    };
    restore();
  }, [connectionId]);

  useEffect(() => {
    if (!isRestored) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await runSave();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, isRestored, runSave]);

  useEffect(() => {
    if (!isRestored || autoResumedRef.current || !selectedDatabase) {
      return;
    }
    const pendingTabs = tabsRef.current.filter((t) => t.pendingExecution);
    if (pendingTabs.length === 0) {
      autoResumedRef.current = true;
      return;
    }
    autoResumedRef.current = true;

    for (const tab of pendingTabs) {
      const pending = tab.pendingExecution;
      if (!pending) {
        continue;
      }
      if (pending.database !== null && pending.database !== selectedDatabase) {
        continue;
      }
      if (DESTRUCTIVE_SQL_PATTERN.test(pending.sql)) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tab.id
              ? {
                  ...t,
                  error:
                    "Query was interrupted — click Run to retry. Not auto-resumed because it may modify data.",
                  errorCode: null,
                  pendingExecution: null,
                  status: "error" as const,
                }
              : t
          )
        );
        toast.warning("Interrupted query not auto-resumed", {
          description: `${tab.title} may modify data — click Run to retry.`,
        });
        continue;
      }
      toast.info("Resuming interrupted query", { description: tab.title });
      execute(tab.id, pending.sql, pending.sourceDialect);
    }
  }, [isRestored, selectedDatabase, execute]);

  useEffect(() => {
    if (!isRestored) {
      return;
    }

    const handleFlush = (event: BeforeUnloadEvent) => {
      runSave();
      if (tabsRef.current.some(isTabDirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        runSave();
      }
    };

    window.addEventListener("beforeunload", handleFlush);
    document.addEventListener("visibilitychange", handleVisibility);

    let disposed = false;
    let unlistenTauri: (() => void) | null = null;

    const setupTauriClose = async () => {
      if (!isTauri()) {
        return;
      }
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (disposed) {
          return;
        }
        const unlisten = await getCurrentWindow().onCloseRequested(
          async (event) => {
            await runSave();
            if (tabsRef.current.some(isTabDirty)) {
              event.preventDefault();
              setCloseRequested(true);
            }
          }
        );
        if (disposed) {
          unlisten();
          return;
        }
        unlistenTauri = unlisten;
      } catch {
        // Best-effort — ignore close-flush setup failures
      }
    };
    setupTauriClose();

    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", handleFlush);
      document.removeEventListener("visibilitychange", handleVisibility);
      unlistenTauri?.();
    };
  }, [isRestored, runSave]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const addTab = useCallback(() => {
    counterRef.current += 1;
    const tab = createNewQueryTab(counterRef.current);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const addTabWithSql = useCallback((sql: string) => {
    counterRef.current += 1;
    const tab: QueryTab = { ...createNewQueryTab(counterRef.current), sql };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const closedIdx = prev.findIndex((t) => t.id === tabId);
        const closed = prev[closedIdx];
        if (closed) {
          closedTabsRef.current = [
            { index: closedIdx, tab: closed },
            ...closedTabsRef.current,
          ].slice(0, MAX_CLOSED_TABS);
        }

        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          counterRef.current = 1;
          const tab = createNewQueryTab(counterRef.current);
          setActiveTabId(tab.id);
          return [tab];
        }
        if (tabId === activeTabId) {
          setActiveTabId(
            next[Math.min(closedIdx, next.length - 1)]?.id ?? next[0]?.id ?? ""
          );
        }
        return next;
      });
    },
    [activeTabId]
  );

  const reopenTab = useCallback(() => {
    const [entry] = closedTabsRef.current;
    if (!entry) {
      return;
    }
    closedTabsRef.current = closedTabsRef.current.slice(1);
    const restoredTab: QueryTab = {
      ...entry.tab,
      error: null,
      errorCode: null,
      executedSql: null,
      pendingExecution: null,
      result: null,
      runningQueryId: null,
      status: "idle",
    };
    setTabs((prev) => {
      const insertAt = Math.min(entry.index, prev.length);
      return [...prev.slice(0, insertAt), restoredTab, ...prev.slice(insertAt)];
    });
    setActiveTabId(restoredTab.id);
  }, []);

  const updateTabSql = useCallback((tabId: string, sql: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, sql } : t)));
  }, []);

  const updateTabDialect = useCallback(
    (tabId: string, dialect: string | null) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, sourceDialect: dialect } : t))
      );
    },
    []
  );

  const executeTab = useCallback(
    (tabId: string, sqlOverride?: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      const sqlToExecute = sqlOverride ?? tab?.sql;
      if (!sqlToExecute?.trim()) {
        return;
      }
      execute(tabId, sqlToExecute, tab?.sourceDialect);
    },
    [execute]
  );

  const cancelTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab?.runningQueryId) {
        return;
      }
      cancel(tab.runningQueryId);
    },
    [cancel]
  );

  const onConfirmClose = useCallback(async () => {
    setCloseRequested(false);
    if (!isTauri()) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().destroy();
    } catch {
      // Best-effort
    }
  }, []);

  const onCancelClose = useCallback(() => {
    setCloseRequested(false);
  }, []);

  return {
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    cancelTab,
    closeRequested,
    closeTab,
    executeTab,
    isRestored,
    onCancelClose,
    onConfirmClose,
    reopenTab,
    setActiveTabId,
    tabs,
    updateTabDialect,
    updateTabSql,
  };
};
