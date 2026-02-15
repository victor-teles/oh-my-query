import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";
import { getConnections } from "@/lib/connections";

const WorkspacePage = () => {
  const { connection } = Route.useRouteContext();
  const { isConnected, isConnecting, error } =
    useConnectionLifecycle(connection);

  return (
    <WorkspaceLayout
      connection={connection}
      isConnected={isConnected}
      isConnecting={isConnecting}
      connectionError={error}
    />
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
