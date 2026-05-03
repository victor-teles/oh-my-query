import { useCallback, useEffect, useRef, useState } from "react";

import type { PersistedTab, TabState } from "@/lib/persistence";
import type { QueryTab } from "@/lib/query-types";

import { getTabs, saveTabs } from "@/lib/persistence";
import {
  createNewQueryTab,
  isTabDirty,
  restoreQueryTabState,
} from "@/lib/query-tab-state";

import { useTabExecution } from "./use-tab-execution";
import { useTabExplain } from "./use-tab-explain";

const SAVE_DEBOUNCE_MS = 150;
const SAVE_ERROR_LOG_THROTTLE_MS = 10_000;
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
  const lastSaveErrorLogRef = useRef(0);
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
    } catch (error) {
      const now = Date.now();
      if (now - lastSaveErrorLogRef.current > SAVE_ERROR_LOG_THROTTLE_MS) {
        lastSaveErrorLogRef.current = now;
        console.warn("Couldn't save tabs", error);
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

  const { cancel: cancelExplainQuery, explain } = useTabExplain({
    connectionId,
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
        continue;
      }
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

    return () => {
      window.removeEventListener("beforeunload", handleFlush);
      document.removeEventListener("visibilitychange", handleVisibility);
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

  const addTabWithSqlAndRun = useCallback(
    (sql: string) => {
      const activeId = activeTabIdRef.current;
      const active = tabsRef.current.find((t) => t.id === activeId);

      if (active && active.sql.trim().length === 0) {
        const replaced: QueryTab = { ...active, sql };
        setTabs((prev) => prev.map((t) => (t.id === active.id ? replaced : t)));
        tabsRef.current = tabsRef.current.map((t) =>
          t.id === active.id ? replaced : t
        );
        execute(active.id, sql, active.sourceDialect);
        return;
      }

      counterRef.current += 1;
      const tab: QueryTab = { ...createNewQueryTab(counterRef.current), sql };
      setTabs((prev) => [...prev, tab]);
      tabsRef.current = [...tabsRef.current, tab];
      setActiveTabId(tab.id);
      execute(tab.id, sql, tab.sourceDialect);
    },
    [execute]
  );

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
      explainError: null,
      explainResult: null,
      explainStatus: "idle",
      pendingExecution: null,
      result: null,
      runningExplainId: null,
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
    (tabId: string, sqlOverride?: string, maxRows?: number) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      const sqlToExecute = sqlOverride ?? tab?.sql;
      if (!sqlToExecute?.trim()) {
        return;
      }
      execute(tabId, sqlToExecute, tab?.sourceDialect, maxRows);
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

  const explainTab = useCallback(
    (tabId: string, sqlOverride?: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) {
        return;
      }
      const sqlToExplain = sqlOverride ?? tab.sql;
      if (!sqlToExplain.trim()) {
        return;
      }
      explain(tabId, sqlToExplain, tab.sourceDialect, tab.explainAnalyze);
    },
    [explain]
  );

  const cancelExplain = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab?.runningExplainId) {
        return;
      }
      cancelExplainQuery(tab.runningExplainId);
    },
    [cancelExplainQuery]
  );

  const setExplainAnalyze = useCallback((tabId: string, analyze: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, explainAnalyze: analyze } : t))
    );
  }, []);

  const onConfirmClose = useCallback(() => {
    setCloseRequested(false);
    window.close();
  }, []);

  const onCancelClose = useCallback(() => {
    setCloseRequested(false);
  }, []);

  return {
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    addTabWithSqlAndRun,
    cancelExplain,
    cancelTab,
    closeRequested,
    closeTab,
    executeTab,
    explainTab,
    isRestored,
    onCancelClose,
    onConfirmClose,
    reopenTab,
    setActiveTabId,
    setExplainAnalyze,
    tabs,
    updateTabDialect,
    updateTabSql,
  };
};
