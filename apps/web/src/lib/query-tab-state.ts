import type { PersistedTab, TabState } from "@/lib/persistence";
import type { QueryTab } from "@/lib/query-types";

const toQueryTab = (persisted: PersistedTab): QueryTab => ({
  error: null,
  errorCode: null,
  executedSql: null,
  id: persisted.id,
  pendingExecution: persisted.pendingExecution ?? null,
  result: null,
  runningQueryId: null,
  sourceDialect: persisted.sourceDialect,
  sql: persisted.sql,
  status: "idle",
  title: persisted.title,
});

export const createNewQueryTab = (
  counter: number,
  createId: () => string = () => crypto.randomUUID()
): QueryTab => ({
  error: null,
  errorCode: null,
  executedSql: null,
  id: createId(),
  pendingExecution: null,
  result: null,
  runningQueryId: null,
  sourceDialect: null,
  sql: "",
  status: "idle",
  title: `Query ${counter}`,
});

export const restoreQueryTabState = (
  saved: TabState | null,
  createId: () => string = () => crypto.randomUUID()
) => {
  if (!saved || saved.tabs.length === 0) {
    const firstTab = createNewQueryTab(1, createId);

    return {
      activeTabId: firstTab.id,
      counter: 1,
      tabs: [firstTab],
    };
  }

  const tabs = saved.tabs.map(toQueryTab);
  const activeTabId = tabs.some((tab) => tab.id === saved.activeTabId)
    ? saved.activeTabId
    : (tabs[0]?.id ?? "");

  return {
    activeTabId,
    counter: Math.max(saved.counter, tabs.length),
    tabs,
  };
};
