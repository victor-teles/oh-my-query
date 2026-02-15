import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { EditorInsertProvider } from "@/contexts/editor-insert-context";
import { QueryExecutionProvider } from "@/contexts/query-execution-context";
import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";
import { getConnections } from "@/lib/connections";

const WorkspacePage = () => {
  const { connection } = Route.useRouteContext();
  const { isConnected, isConnecting, error, serverVersion } =
    useConnectionLifecycle(connection);

  return (
    <QueryExecutionProvider>
      <EditorInsertProvider>
        <WorkspaceLayout
          connection={connection}
          isConnected={isConnected}
          isConnecting={isConnecting}
          connectionError={error}
          serverVersion={serverVersion}
        />
      </EditorInsertProvider>
    </QueryExecutionProvider>
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
