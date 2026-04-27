import { useEffect } from "react";

import type { QueryTab } from "@/lib/query-types";

import { useActiveQuery } from "@/contexts/active-query-context";
import { useQueryExecution } from "@/contexts/query-execution-context";

export const useActiveQuerySync = (activeTab: QueryTab | undefined) => {
  const { setExecutionState } = useQueryExecution();
  const { setActiveSql, setExecutionSnapshot, setSelectedSql, setTabTitle } =
    useActiveQuery();

  useEffect(() => {
    if (activeTab?.status) {
      setExecutionState({
        error: activeTab.error ?? null,
        result: activeTab.result ?? null,
        status: activeTab.status,
      });
    }
  }, [
    activeTab?.status,
    activeTab?.result,
    activeTab?.error,
    setExecutionState,
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
