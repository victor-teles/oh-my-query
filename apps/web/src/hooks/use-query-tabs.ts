import { useCallback, useEffect, useRef, useState } from "react";

import type { PersistedTab, TabState } from "@/lib/persistence";
import type { QueryTab } from "@/lib/query-types";

import { getTabs, saveTabs } from "@/lib/persistence";

import { useTabExecution } from "./use-tab-execution";

const SAVE_DEBOUNCE_MS = 500;

const createNewTab = (counter: number): QueryTab => ({
  error: null,
  executedSql: null,
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
  executedSql: null,
  id: persisted.id,
  result: null,
  sourceDialect: persisted.sourceDialect,
  sql: persisted.sql,
  status: "idle",
  title: persisted.title,
});

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
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const { execute } = useTabExecution({
    connectionId,
    selectedDatabase,
    setTabs,
  });

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
