import type { ReactNode } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { ActiveQueryProvider } from "@/contexts/active-query-context";
import { ConnectionProvider } from "@/contexts/connection-context";
import { EditorInsertProvider } from "@/contexts/editor-insert-context";
import { QueryExecutionProvider } from "@/contexts/query-execution-context";
import { SafeModeProvider } from "@/contexts/safe-mode-context";

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
          <EditorInsertProvider>{children}</EditorInsertProvider>
        </ActiveQueryProvider>
      </QueryExecutionProvider>
    </SafeModeProvider>
  </ConnectionProvider>
);
