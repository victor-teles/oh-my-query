import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { EditorInsertProvider } from "@/contexts/editor-insert-context";
import { QueryExecutionProvider } from "@/contexts/query-execution-context";
import { SafeModeProvider } from "@/contexts/safe-mode-context";
import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";
import { getConnections } from "@/lib/connections";

const WorkspacePage = () => {
  const { connection } = Route.useRouteContext();
  const {
    isConnected,
    isConnecting,
    isReconnecting,
    error,
    serverVersion,
    reconnect,
  } = useConnectionLifecycle(connection);

  return (
    <SafeModeProvider>
      <QueryExecutionProvider>
        <EditorInsertProvider>
          <WorkspaceLayout
            connection={connection}
            connectionError={error}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isReconnecting={isReconnecting}
            onReconnect={reconnect}
            serverVersion={serverVersion}
          />
        </EditorInsertProvider>
      </QueryExecutionProvider>
    </SafeModeProvider>
  );
};

export const Route = createFileRoute("/workspace/$connectionId")({
  beforeLoad: ({ params }) => {
    const connections = getConnections();
    const connection = connections.find((c) => c.id === params.connectionId);
    if (!connection) {
      throw redirect({ to: "/" });
    }
    return { connection };
  },
  component: WorkspacePage,
});
