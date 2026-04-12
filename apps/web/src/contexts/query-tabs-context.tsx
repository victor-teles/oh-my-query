import type { ReactNode } from "react";

import { createContext, use } from "react";

import type { QueryTab } from "@/lib/query-types";

interface QueryTabsContextValue {
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  activeTabId: string;
  addTab: () => void;
  addTabWithSql: (sql: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (id: string) => void;
  updateTabDialect: (tabId: string, dialect: string | null) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  executeTab: (tabId: string, sqlOverride?: string) => void;
  cancelTab: (tabId: string) => void;
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
