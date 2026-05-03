import type { ReactNode } from "react";

import { createContext, use } from "react";

import type { ExplainDensity, QueryTab } from "@/lib/query-types";

interface QueryTabsContextValue {
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  activeTabId: string;
  addTab: () => void;
  addTabWithSql: (sql: string) => void;
  addTabWithSqlAndRun: (sql: string) => void;
  closeTab: (tabId: string) => void;
  reopenTab: () => void;
  setActiveTabId: (id: string) => void;
  updateTabDialect: (tabId: string, dialect: string | null) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  executeTab: (tabId: string, sqlOverride?: string, maxRows?: number) => void;
  cancelTab: (tabId: string) => void;
  explainTab: (tabId: string, sqlOverride?: string) => void;
  cancelExplain: (tabId: string) => void;
  setExplainAnalyze: (tabId: string, analyze: boolean) => void;
  setExplainDensity: (tabId: string, density: ExplainDensity) => void;
  closeRequested: boolean;
  onConfirmClose: () => void;
  onCancelClose: () => void;
}

const QueryTabsContext = createContext<QueryTabsContextValue | null>(null);

export const QueryTabsProvider = ({
  value,
  children,
}: {
  value: QueryTabsContextValue;
  children: ReactNode;
}) => <QueryTabsContext value={value}>{children}</QueryTabsContext>;

export const useQueryTabsContext = (): QueryTabsContextValue => {
  const ctx = use(QueryTabsContext);
  if (!ctx) {
    throw new Error(
      "useQueryTabsContext must be used within a QueryTabsProvider"
    );
  }
  return ctx;
};
