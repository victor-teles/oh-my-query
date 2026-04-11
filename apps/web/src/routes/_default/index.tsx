import { useHotkey } from "@tanstack/react-hotkeys";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Settings } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionForm } from "@/components/connection-form";
import { Titlebar } from "@/components/titlebar/titlebar";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsland } from "@/contexts/island-context";
import {
  deleteConnection,
  getConnections,
  saveConnection,
  togglePinConnection,
} from "@/lib/connections";
import {
  isFirstConnectionSeen,
  markFirstConnectionSeen,
} from "@/lib/first-connection";

import { AddConnectionDialog } from "./-components/add-connection-dialog";
import { ConnectionList } from "./-components/connection-list";
import { EditConnectionDialog } from "./-components/edit-connection-dialog";
import { KeyboardHints } from "./-components/keyboard-hints";

const UNDO_DURATION_MS = 5000;
const WELCOME_DURATION_MS = 3000;

const HomeComponent = () => {
  const navigate = useNavigate();
  const { setSnapshot } = useIsland();
  const [connections, setConnections] = useState(getConnections);
  const [editTarget, setEditTarget] = useState<DatabaseConnection | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [launchingConnection, setLaunchingConnection] =
    useState<DatabaseConnection | null>(null);
  const [welcomeActive, setWelcomeActive] = useState(false);
  const [firstConnectionId, setFirstConnectionId] = useState<string | null>(
    null
  );
  const listboxRef = useRef<HTMLDivElement>(null);

  const { pinned, unpinned } = useMemo(() => {
    const sortByRecency = (a: DatabaseConnection, b: DatabaseConnection) => {
      const aTime = a.lastConnectedAt
        ? new Date(a.lastConnectedAt).getTime()
        : 0;
      const bTime = b.lastConnectedAt
        ? new Date(b.lastConnectedAt).getTime()
        : 0;
      return bTime - aTime;
    };
    return {
      pinned: connections.filter((c) => c.pinned).toSorted(sortByRecency),
      unpinned: connections.filter((c) => !c.pinned).toSorted(sortByRecency),
    };
  }, [connections]);

  const flatList = useMemo(() => [...pinned, ...unpinned], [pinned, unpinned]);

  const selectedConnection = useMemo(
    () => flatList.find((c) => c.id === selectedId) ?? null,
    [flatList, selectedId]
  );

  useEffect(() => {
    if (flatList.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && flatList.some((c) => c.id === current)) {
        return current;
      }
      return flatList[0]?.id ?? null;
    });
  }, [flatList]);

  useEffect(() => {
    if (connections.length > 0) {
      listboxRef.current?.focus();
    }
  }, [connections.length]);

  useEffect(() => {
    if (welcomeActive) {
      setSnapshot({ kind: "welcome" });
      return;
    }
    if (launchingConnection) {
      setSnapshot({
        connectionName: launchingConnection.name,
        kind: "connecting",
      });
      return;
    }
    if (selectedConnection) {
      setSnapshot({
        connectionName: selectedConnection.name,
        kind: "ambient",
      });
      return;
    }
    setSnapshot({ kind: "hidden" });
  }, [welcomeActive, launchingConnection, selectedConnection, setSnapshot]);

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
    const timer = setTimeout(() => setFirstConnectionId(null), 900);
    return () => clearTimeout(timer);
  }, [firstConnectionId]);

  const handleDelete = useCallback((connection: DatabaseConnection) => {
    deleteConnection(connection.id);
    setConnections(getConnections());
    toast(`"${connection.name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          saveConnection(connection);
          setConnections(getConnections());
        },
      },
      duration: UNDO_DURATION_MS,
    });
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

  const handleSettings = useCallback(() => {
    navigate({ to: "/settings" });
  }, [navigate]);

  const handleAddOpen = useCallback(() => {
    setAddOpen(true);
  }, []);

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
      setConnections(getConnections());
      setSelectedId(connection.id);
      setFirstConnectionId(connection.id);
      setWelcomeActive(true);
    },
    [navigate]
  );

  const launchConnection = useCallback(
    (connection: DatabaseConnection) => {
      setSelectedId(connection.id);
      setLaunchingConnection(connection);
      navigate({
        params: { connectionId: connection.id },
        to: "/workspace/$connectionId",
      });
    },
    [navigate]
  );

  const prepareLaunch = useCallback((connection: DatabaseConnection) => {
    setSelectedId(connection.id);
    setLaunchingConnection(connection);
  }, []);

  const handleTogglePin = useCallback((connection: DatabaseConnection) => {
    togglePinConnection(connection.id);
    setConnections(getConnections());
  }, []);

  const isDialogOpen = addOpen || editTarget !== null;

  useHotkey("Mod+N", () => {
    if (connections.length > 0) {
      setAddOpen(true);
    }
  });

  useHotkey("Mod+,", () => {
    navigate({ to: "/settings" });
  });

  useHotkey("ArrowDown", () => {
    if (isDialogOpen || flatList.length === 0) {
      return;
    }
    const currentIndex = flatList.findIndex((c) => c.id === selectedId);
    const nextIndex = Math.min(currentIndex + 1, flatList.length - 1);
    const next = flatList[nextIndex];
    if (next) {
      setSelectedId(next.id);
    }
  });

  useHotkey("ArrowUp", () => {
    if (isDialogOpen || flatList.length === 0) {
      return;
    }
    const currentIndex = flatList.findIndex((c) => c.id === selectedId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const prev = flatList[prevIndex];
    if (prev) {
      setSelectedId(prev.id);
    }
  });

  useHotkey("Enter", () => {
    if (isDialogOpen) {
      return;
    }
    const selected = flatList.find((c) => c.id === selectedId);
    if (selected) {
      launchConnection(selected);
    }
  });

  useHotkey("Mod+Backspace", () => {
    if (isDialogOpen) {
      return;
    }
    const selected = flatList.find((c) => c.id === selectedId);
    if (selected) {
      handleDelete(selected);
    }
  });

  const isEmpty = connections.length === 0;

  return (
    <>
      <Titlebar>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Settings"
                onClick={handleSettings}
              />
            }
          >
            <Settings className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>
            Settings{" "}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>,</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
        {!isEmpty && (
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
            <TooltipContent>
              New connection{" "}
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>N</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        )}
      </Titlebar>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <AnimatePresence initial={false} mode="wait">
          {isEmpty ? (
            <motion.div
              key="empty"
              className="w-full max-w-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <h1 className="px-0.5 text-2xl font-medium leading-[1.1] tracking-tight text-foreground">
                Connect your first database
              </h1>
              <p className="mb-8 mt-3 px-0.5 text-sm leading-relaxed text-muted-foreground">
                Works with Postgres, MySQL, SQLite, MongoDB, Redis, and
                ClickHouse — with an AI that knows your schema.
              </p>
              <ConnectionForm onSuccess={handleConnectSuccess} />
            </motion.div>
          ) : (
            <motion.div
              key="populated"
              className="w-full max-w-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <h1 className="mb-8 px-0.5 text-2xl font-medium leading-[1.1] tracking-tight text-foreground">
                Your databases
              </h1>

              <LayoutGroup>
                <div
                  ref={listboxRef}
                  tabIndex={0}
                  role="listbox"
                  aria-label="Database connections"
                  aria-activedescendant={selectedId ?? undefined}
                  className="flex flex-col gap-9 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {pinned.length > 0 && (
                    <section aria-labelledby="connections-pinned-heading">
                      <h2
                        id="connections-pinned-heading"
                        className="mb-3 px-0.5 text-section-label"
                      >
                        Pinned
                      </h2>
                      <ConnectionList
                        connections={pinned}
                        selectedId={selectedId}
                        glowingId={firstConnectionId}
                        onEditRequest={handleEditRequest}
                        onDeleteRequest={handleDelete}
                        onTogglePin={handleTogglePin}
                        onLaunch={prepareLaunch}
                      />
                    </section>
                  )}

                  {unpinned.length > 0 && (
                    <section aria-labelledby="connections-recent-heading">
                      <h2
                        id="connections-recent-heading"
                        className="mb-3 px-0.5 text-section-label"
                      >
                        Recent
                      </h2>
                      <ConnectionList
                        connections={unpinned}
                        selectedId={selectedId}
                        glowingId={firstConnectionId}
                        onEditRequest={handleEditRequest}
                        onDeleteRequest={handleDelete}
                        onTogglePin={handleTogglePin}
                        onLaunch={prepareLaunch}
                      />
                    </section>
                  )}
                </div>
              </LayoutGroup>

              <KeyboardHints />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddConnectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleConnectSuccess}
      />

      <EditConnectionDialog
        connection={editTarget}
        open={editTarget !== null}
        onOpenChange={handleEditOpenChange}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export const Route = createFileRoute("/_default/")({
  component: HomeComponent,
});
