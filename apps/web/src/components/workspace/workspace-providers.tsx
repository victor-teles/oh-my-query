import type { ReactNode } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { ActiveQueryProvider } from "@/contexts/active-query-context";
import { ConnectionProvider } from "@/contexts/connection-context";
import { EditorInsertProvider } from "@/contexts/editor-insert-context";
import { QueryExecutionProvider } from "@/contexts/query-execution-context";
import {
  RecentTablesProvider,
  useRecentTablesContext,
} from "@/contexts/recent-tables-context";
import { SafeModeProvider } from "@/contexts/safe-mode-context";

const EditorInsertWithRecent = ({ children }: { children: ReactNode }) => {
  const { markUsed } = useRecentTablesContext();
  return (
    <EditorInsertProvider onTableUsed={markUsed}>
      {children}
    </EditorInsertProvider>
  );
};

export const WorkspaceProviders = ({
  connection,
  children,
}: {
  connection: DatabaseConnection;
  children: ReactNode;
}) => (
  <ConnectionProvider connection={connection}>
    <SafeModeProvider>
      <QueryExecutionProvider>
        <ActiveQueryProvider>
          <RecentTablesProvider connectionId={connection.id}>
            <EditorInsertWithRecent>{children}</EditorInsertWithRecent>
          </RecentTablesProvider>
        </ActiveQueryProvider>
      </QueryExecutionProvider>
    </SafeModeProvider>
  </ConnectionProvider>
);
