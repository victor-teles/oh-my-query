import type { ReactNode } from "react";

import { createContext, use } from "react";

import { useRecentTables } from "@/hooks/use-recent-tables";

interface RecentTablesContextValue {
  recentTables: string[];
  markUsed: (tableName: string) => void;
}

const RecentTablesContext = createContext<RecentTablesContextValue | null>(
  null
);

export const RecentTablesProvider = ({
  connectionId,
  children,
}: {
  connectionId: string;
  children: ReactNode;
}) => {
  const { recentTables, markUsed } = useRecentTables(connectionId);

  return (
    <RecentTablesContext value={{ markUsed, recentTables }}>
      {children}
    </RecentTablesContext>
  );
};

export const useRecentTablesContext = (): RecentTablesContextValue => {
  const ctx = use(RecentTablesContext);
  if (!ctx) {
    throw new Error(
      "useRecentTablesContext must be used within a RecentTablesProvider"
    );
  }
  return ctx;
};
