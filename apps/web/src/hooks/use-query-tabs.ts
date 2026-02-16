import { useCallback, useRef, useState } from "react";

import type { QueryTab } from "@/lib/query-types";

import { executeQuery } from "@/lib/tauri";

const createNewTab = (counter: number): QueryTab => ({
  error: null,
  id: crypto.randomUUID(),
  result: null,
  sql: "",
  status: "idle",
  title: `Query ${counter}`,
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

export const useQueryTabs = (connectionId: string) => {
  const counterRef = useRef(1);
  const [tabs, setTabs] = useState<QueryTab[]>(() => [
    createNewTab(counterRef.current),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id ?? ""
  );

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
          counterRef.current += 1;
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

  const executeTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab?.sql.trim()) {
        return;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, error: null, result: null, status: "running" as const }
            : t
        )
      );

      try {
        const result = await executeQuery({
          connectionId,
          sql: tab.sql,
        });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, error: null, result, status: "success" as const }
              : t
          )
        );
      } catch (error) {
        const message = extractErrorMessage(error);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, error: message, result: null, status: "error" as const }
              : t
          )
        );
      }
    },
    [connectionId, tabs]
  );

  return {
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    closeTab,
    executeTab,
    setActiveTabId,
    tabs,
    updateTabSql,
  };
};
