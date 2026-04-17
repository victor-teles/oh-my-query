import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { WorkspaceProviders } from "@/components/workspace/workspace-providers";
import { getConnections } from "@/lib/connections";

const WorkspacePage = () => {
  const { connection } = Route.useRouteContext();
  return (
    <WorkspaceProviders connection={connection}>
      <WorkspaceLayout />
    </WorkspaceProviders>
  );
};

export const Route = createFileRoute("/workspace/$connectionId")({
  beforeLoad: async ({ params }) => {
    const connections = await getConnections();
    const connection = connections.find((c) => c.id === params.connectionId);
    if (!connection) {
      throw redirect({ to: "/" });
    }
    return { connection };
  },
  component: WorkspacePage,
});
