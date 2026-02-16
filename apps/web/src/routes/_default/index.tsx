import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Titlebar } from "@/components/titlebar/titlebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteConnection, getConnections } from "@/lib/connections";

import { AddConnectionDialog } from "./-components/add-connection-dialog";
import { ConnectionList } from "./-components/connection-list";
import { DeleteConnectionDialog } from "./-components/delete-connection-dialog";
import { EditConnectionDialog } from "./-components/edit-connection-dialog";

const HomeComponent = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState(getConnections);
  const [deleteTarget, setDeleteTarget] = useState<DatabaseConnection | null>(
    null
  );
  const [editTarget, setEditTarget] = useState<DatabaseConnection | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleDeleteRequest = useCallback((connection: DatabaseConnection) => {
    setDeleteTarget(connection);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    deleteConnection(deleteTarget.id);
    setDeleteTarget(null);

    const remaining = getConnections();
    if (remaining.length === 0) {
      navigate({ to: "/onboarding" });
    } else {
      setConnections(remaining);
    }
  }, [deleteTarget, navigate]);

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const handleEditRequest = useCallback((connection: DatabaseConnection) => {
    setEditTarget(connection);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditTarget(null);
    setConnections(getConnections());
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditTarget(null);
    }
  }, []);

  const handleAddOpen = useCallback(() => {
    setAddOpen(true);
  }, []);

  const handleAddSuccess = useCallback(
    (connection: DatabaseConnection) => {
      setAddOpen(false);
      navigate({
        params: { connectionId: connection.id },
        to: "/workspace/$connectionId",
      });
    },
    [navigate]
  );

  return (
    <>
      <Titlebar>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New connection"
                onClick={handleAddOpen}
              />
            }
          >
            <Plus className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>New connection</TooltipContent>
        </Tooltip>
      </Titlebar>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <h1 className="text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
              Connections
            </h1>
            <span className="text-[0.625rem] text-muted-foreground">
              {connections.length}
            </span>
          </div>

          <ConnectionList
            connections={connections}
            onEditRequest={handleEditRequest}
            onDeleteRequest={handleDeleteRequest}
          />
        </div>
      </div>

      <AddConnectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleAddSuccess}
      />

      <EditConnectionDialog
        connection={editTarget}
        open={editTarget !== null}
        onOpenChange={handleEditOpenChange}
        onSuccess={handleEditSuccess}
      />

      <DeleteConnectionDialog
        connection={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDeleteConfirm}
      />
    </>
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
