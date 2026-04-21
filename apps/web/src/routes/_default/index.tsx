import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { HomeActions } from "@/components/command-palette/actions/home-actions";
import { Titlebar } from "@/components/titlebar/titlebar";
import {
  isFirstConnectionSeen,
  markFirstConnectionSeen,
} from "@/lib/first-connection";

import { AddConnectionDialog } from "./-components/add-connection-dialog";
import { ConnectionsBoard } from "./-components/connections-board";
import { ConnectionsEmptyState } from "./-components/connections-empty-state";
import { EditConnectionDialog } from "./-components/edit-connection-dialog";
import { HomeTitlebarActions } from "./-components/home-titlebar-actions";
import { useConnectionSelection } from "./-hooks/use-connection-selection";
import { useConnections } from "./-hooks/use-connections";
import { useHomeHotkeys } from "./-hooks/use-home-hotkeys";
import { useHomeIslandSync } from "./-hooks/use-home-island-sync";

const WELCOME_DURATION_MS = 3000;
const GLOW_DURATION_MS = 900;

const HomeComponent = () => {
  const navigate = useNavigate();
  const {
    connections,
    isLoading,
    pinned,
    unpinned,
    flatList,
    refresh,
    remove,
    togglePin,
  } = useConnections();
  const { listboxRef, selectedConnection, selectedId, setSelectedId } =
    useConnectionSelection(flatList);

  const [editTarget, setEditTarget] = useState<DatabaseConnection | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [launchingConnection, setLaunchingConnection] =
    useState<DatabaseConnection | null>(null);
  const [welcomeActive, setWelcomeActive] = useState(false);
  const [firstConnectionId, setFirstConnectionId] = useState<string | null>(
    null
  );

  useHomeIslandSync({
    launchingConnection,
    selectedConnection,
    welcomeActive,
  });

  useEffect(() => {
    if (!welcomeActive) {
      return;
    }
    const timer = setTimeout(
      () => setWelcomeActive(false),
      WELCOME_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [welcomeActive]);

  useEffect(() => {
    if (!firstConnectionId) {
      return;
    }
    const timer = setTimeout(
      () => setFirstConnectionId(null),
      GLOW_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [firstConnectionId]);

  const handleEditRequest = useCallback((connection: DatabaseConnection) => {
    setEditTarget(connection);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditTarget(null);
    refresh();
  }, [refresh]);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditTarget(null);
    }
  }, []);

  const handleSettings = useCallback(() => {
    navigate({ to: "/settings" });
  }, [navigate]);

  const handleAddOpen = useCallback(() => {
    setAddOpen(true);
  }, []);

  const launchConnection = useCallback(
    (connection: DatabaseConnection) => {
      setSelectedId(connection.id);
      setLaunchingConnection(connection);
      navigate({
        params: { connectionId: connection.id },
        to: "/workspace/$connectionId",
      });
    },
    [navigate, setSelectedId]
  );

  const prepareLaunch = useCallback(
    (connection: DatabaseConnection) => {
      setSelectedId(connection.id);
      setLaunchingConnection(connection);
    },
    [setSelectedId]
  );

  const handleConnectSuccess = useCallback(
    (connection: DatabaseConnection) => {
      setAddOpen(false);
      if (isFirstConnectionSeen()) {
        setLaunchingConnection(connection);
        navigate({
          params: { connectionId: connection.id },
          to: "/workspace/$connectionId",
        });
        return;
      }
      markFirstConnectionSeen();
      refresh();
      setSelectedId(connection.id);
      setFirstConnectionId(connection.id);
      setWelcomeActive(true);
    },
    [navigate, refresh, setSelectedId]
  );

  const isDialogOpen = addOpen || editTarget !== null;

  useHomeHotkeys({
    enabled: !isDialogOpen,
    flatList,
    onDelete: remove,
    onLaunch: launchConnection,
    onOpenAdd: handleAddOpen,
    selectedId,
    setSelectedId,
  });

  const isEmpty = !isLoading && connections.length === 0;

  return (
    <>
      <HomeActions connections={connections} onOpenAdd={handleAddOpen} />
      <Titlebar>
        <HomeTitlebarActions
          onAdd={handleAddOpen}
          onSettings={handleSettings}
          showAdd={!isEmpty}
        />
      </Titlebar>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <AnimatePresence initial={false} mode="wait">
          {isEmpty ? (
            <ConnectionsEmptyState
              key="empty"
              onSuccess={handleConnectSuccess}
            />
          ) : (
            <ConnectionsBoard
              glowingId={firstConnectionId}
              key="populated"
              listboxRef={listboxRef}
              onDeleteRequest={remove}
              onEditRequest={handleEditRequest}
              onLaunch={prepareLaunch}
              onTogglePin={togglePin}
              pinned={pinned}
              selectedId={selectedId}
              unpinned={unpinned}
            />
          )}
        </AnimatePresence>
      </div>

      <AddConnectionDialog
        onOpenChange={setAddOpen}
        onSuccess={handleConnectSuccess}
        open={addOpen}
      />

      <EditConnectionDialog
        connection={editTarget}
        onOpenChange={handleEditOpenChange}
        onSuccess={handleEditSuccess}
        open={editTarget !== null}
      />
    </>
  );
};

export const Route = createFileRoute("/_default/")({
  component: HomeComponent,
});
