import { useEffect } from "react";

import type { QueryTab } from "@/lib/query-types";

import { useActiveQuery } from "@/contexts/active-query-context";
import { useQueryExecution } from "@/contexts/query-execution-context";
import { useQueryTabsContext } from "@/contexts/query-tabs-context";

export const useActiveQuerySync = (activeTab: QueryTab | undefined) => {
  const { setExecutionState, setCancelActive } = useQueryExecution();
  const { cancelTab } = useQueryTabsContext();
  const { setActiveSql, setExecutionSnapshot, setSelectedSql, setTabTitle } =
    useActiveQuery();

  useEffect(() => {
    if (activeTab?.status) {
      const startedAtIso = activeTab.pendingExecution?.startedAt;
      const startedAt =
        activeTab.status === "running" && startedAtIso
          ? Date.parse(startedAtIso)
          : null;
      setExecutionState({
        error: activeTab.error ?? null,
        result: activeTab.result ?? null,
        startedAt: Number.isFinite(startedAt) ? startedAt : null,
        status: activeTab.status,
      });
    }
  }, [
    activeTab?.status,
    activeTab?.result,
    activeTab?.error,
    activeTab?.pendingExecution?.startedAt,
    setExecutionState,
  ]);

  useEffect(() => {
    if (activeTab?.status === "running" && activeTab.runningQueryId) {
      const tabId = activeTab.id;
      setCancelActive(() => cancelTab(tabId));
      return () => setCancelActive(null);
    }
    setCancelActive(null);
  }, [
    activeTab?.id,
    activeTab?.status,
    activeTab?.runningQueryId,
    cancelTab,
    setCancelActive,
  ]);

  useEffect(() => {
    setActiveSql(activeTab?.sql ?? "");
  }, [activeTab?.id, activeTab?.sql, setActiveSql]);

  useEffect(() => {
    setTabTitle(activeTab?.title ?? null);
  }, [activeTab?.title, setTabTitle]);

  useEffect(() => {
    setSelectedSql(null);
  }, [activeTab?.id, setSelectedSql]);

  useEffect(() => {
    setExecutionSnapshot({
      error: activeTab?.error ?? null,
      errorCode: activeTab?.errorCode ?? null,
      executedSql: activeTab?.executedSql ?? null,
      result: activeTab?.result ?? null,
      runningSql: activeTab?.pendingExecution?.sql ?? null,
      status: activeTab?.status ?? "idle",
    });
  }, [
    activeTab?.status,
    activeTab?.result,
    activeTab?.error,
    activeTab?.errorCode,
    activeTab?.executedSql,
    activeTab?.pendingExecution?.sql,
    setExecutionSnapshot,
  ]);
};
