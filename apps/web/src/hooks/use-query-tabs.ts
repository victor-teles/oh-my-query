import { useCallback, useEffect, useRef, useState } from "react";

import type { PersistedTab, TabState } from "@/lib/persistence";
import type { QueryTab } from "@/lib/query-types";

import { appendHistory, getTabs, saveTabs } from "@/lib/persistence";
import { executeQuery } from "@/lib/tauri";

const SAVE_DEBOUNCE_MS = 500;

const createNewTab = (counter: number): QueryTab => ({
  error: null,
  id: crypto.randomUUID(),
  result: null,
  sourceDialect: null,
  sql: "",
  status: "idle",
  title: `Query ${counter}`,
});

const toPersistedTab = (tab: QueryTab): PersistedTab => ({
  id: tab.id,
  sourceDialect: tab.sourceDialect,
  sql: tab.sql,
  title: tab.title,
});

const fromPersistedTab = (persisted: PersistedTab): QueryTab => ({
  error: null,
  id: persisted.id,
  result: null,
  sourceDialect: persisted.sourceDialect,
  sql: persisted.sql,
  status: "idle",
  title: persisted.title,
});

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Query execution failed";
};

export const useQueryTabs = (
  connectionId: string,
  selectedDatabase: string | null
) => {
  const counterRef = useRef(1);
  const [tabs, setTabs] = useState<QueryTab[]>(() => [
    createNewTab(counterRef.current),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id ?? ""
  );
  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await getTabs(connectionId);
        if (saved && saved.tabs.length > 0) {
          const restoredTabs = saved.tabs.map(fromPersistedTab);
          counterRef.current = saved.counter;
          setTabs(restoredTabs);
          setActiveTabId(saved.activeTabId);
        }
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
      const state: TabState = {
        activeTabId,
        counter: counterRef.current,
        tabs: tabs.map(toPersistedTab),
      };
      try {
        await saveTabs(connectionId, state);
      } catch {
        // Silently ignore save failures
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, connectionId, isRestored]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const addTab = useCallback(() => {
    counterRef.current += 1;
    const tab = createNewTab(counterRef.current);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const addTabWithSql = useCallback((sql: string) => {
    counterRef.current += 1;
    const tab: QueryTab = { ...createNewTab(counterRef.current), sql };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          counterRef.current = 1;
          const tab = createNewTab(counterRef.current);
          setActiveTabId(tab.id);
          return [tab];
        }
        if (tabId === activeTabId) {
          const closedIdx = prev.findIndex((t) => t.id === tabId);
          setActiveTabId(
            next[Math.min(closedIdx, next.length - 1)]?.id ?? next[0]?.id ?? ""
          );
        }
        return next;
      });
    },
    [activeTabId]
  );

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
    async (tabId: string, sqlOverride?: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      const sqlToExecute = sqlOverride ?? tab?.sql;
      if (!sqlToExecute?.trim()) {
        return;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, error: null, result: null, status: "running" as const }
            : t
        )
      );

      const startTime = performance.now();
      let success = false;
      let errorMessage: string | null = null;
      let executionTimeMs = 0;

      try {
        const result = await executeQuery({
          connectionId,
          schema: selectedDatabase ?? undefined,
          sourceDialect: tab?.sourceDialect ?? undefined,
          sql: sqlToExecute,
        });
        ({ executionTimeMs } = result);
        success = true;
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, error: null, result, status: "success" as const }
              : t
          )
        );
      } catch (error) {
        const message = extractErrorMessage(error);
        errorMessage = message;
        executionTimeMs = Math.round(performance.now() - startTime);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, error: message, result: null, status: "error" as const }
              : t
          )
        );
      }

      try {
        await appendHistory({
          connectionId,
          database: selectedDatabase,
          error: errorMessage,
          executionTimeMs,
          sql: sqlToExecute,
          success,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Silently ignore history write failures
      }
    },
    [connectionId, selectedDatabase, tabs]
  );

  return {
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    closeTab,
    executeTab,
    isRestored,
    setActiveTabId,
    tabs,
    updateTabDialect,
    updateTabSql,
  };
};
