import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Database, Trash2 } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteConnection, getConnections } from "@/lib/connections";

const ConnectionItem = ({
  connection,
  onDelete,
}: {
  connection: DatabaseConnection;
  onDelete: (id: string) => void;
}) => {
  const subtitle =
    connection.type === "sqlite"
      ? connection.database
      : `${connection.host}:${connection.port}/${connection.database}`;

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete(connection.id);
    },
    [onDelete, connection.id]
  );

  return (
    <Link
      to="/workspace/$connectionId"
      params={{ connectionId: connection.id }}
      className="block"
    >
      <Card size="sm" className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="text-muted-foreground size-4" />
            <div className="flex-1">
              <CardTitle>{connection.name}</CardTitle>
              <CardDescription>
                {connection.type} &middot; {subtitle}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDelete}
              aria-label={`Delete ${connection.name}`}
            >
              <Trash2 />
            </Button>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
};

const HomeComponent = () => {
  const connections = getConnections();

  const handleDelete = useCallback((id: string) => {
    deleteConnection(id);
    const remaining = getConnections();
    if (remaining.length === 0) {
      window.location.href = "/onboarding";
    } else {
      window.location.reload();
    }
  }, []);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Connections</h1>
        <Link to="/onboarding">
          <Button variant="outline" size="sm">
            Add connection
          </Button>
        </Link>
      </div>
      <div className="grid gap-3">
        {connections.map((conn) => (
          <ConnectionItem
            key={conn.id}
            connection={conn}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_default/")({
  beforeLoad: () => {
    const connections = getConnections();
    if (connections.length === 0) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: HomeComponent,
});
