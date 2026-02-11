import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { getConnections } from "@/lib/connections";

const WorkspacePage = () => {
  const { connection } = Route.useRouteContext();

  return <WorkspaceLayout connection={connection} />;
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
