import { useHotkey } from "@tanstack/react-hotkeys";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
import {
  deleteConnection,
  getConnections,
  saveConnection,
  togglePinConnection,
} from "@/lib/connections";

import { AddConnectionDialog } from "./-components/add-connection-dialog";
import { ConnectionList } from "./-components/connection-list";
import { EditConnectionDialog } from "./-components/edit-connection-dialog";

const UNDO_DURATION_MS = 5000;

const HomeComponent = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState(getConnections);
  const [editTarget, setEditTarget] = useState<DatabaseConnection | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

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
      listContainerRef.current?.focus();
    }
  }, [connections.length]);

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
      navigate({
        params: { connectionId: connection.id },
        to: "/workspace/$connectionId",
      });
    },
    [navigate]
  );

  const handleTogglePin = useCallback((connection: DatabaseConnection) => {
    togglePinConnection(connection.id);
    setConnections(getConnections());
  }, []);

  useHotkey("Mod+N", () => {
    if (connections.length > 0) {
      setAddOpen(true);
    }
  });

  useHotkey("Mod+,", () => {
    navigate({ to: "/settings" });
  });

  useHotkey(
    "ArrowDown",
    () => {
      if (flatList.length === 0) {
        return;
      }
      const currentIndex = flatList.findIndex((c) => c.id === selectedId);
      const nextIndex = Math.min(currentIndex + 1, flatList.length - 1);
      const next = flatList[nextIndex];
      if (next) {
        setSelectedId(next.id);
      }
    },
    { target: listContainerRef }
  );

  useHotkey(
    "ArrowUp",
    () => {
      if (flatList.length === 0) {
        return;
      }
      const currentIndex = flatList.findIndex((c) => c.id === selectedId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prev = flatList[prevIndex];
      if (prev) {
        setSelectedId(prev.id);
      }
    },
    { target: listContainerRef }
  );

  useHotkey(
    "Enter",
    () => {
      const selected = flatList.find((c) => c.id === selectedId);
      if (selected) {
        navigate({
          params: { connectionId: selected.id },
          to: "/workspace/$connectionId",
        });
      }
    },
    { target: listContainerRef }
  );

  useHotkey(
    "Backspace",
    () => {
      const selected = flatList.find((c) => c.id === selectedId);
      if (selected) {
        handleDelete(selected);
      }
    },
    { target: listContainerRef }
  );

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
              ref={listContainerRef}
              tabIndex={-1}
              className="w-full max-w-md outline-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <h1 className="mb-8 px-0.5 text-2xl font-medium leading-[1.1] tracking-tight text-foreground">
                Your databases
              </h1>

              {pinned.length > 0 && (
                <section className="mb-9">
                  <div className="mb-3 px-0.5">
                    <h2 className="text-section-label">Pinned</h2>
                  </div>
                  <ConnectionList
                    connections={pinned}
                    selectedId={selectedId}
                    onEditRequest={handleEditRequest}
                    onDeleteRequest={handleDelete}
                    onTogglePin={handleTogglePin}
                    onSelect={setSelectedId}
                  />
                </section>
              )}

              {unpinned.length > 0 && (
                <ConnectionList
                  connections={unpinned}
                  selectedId={selectedId}
                  onEditRequest={handleEditRequest}
                  onDeleteRequest={handleDelete}
                  onTogglePin={handleTogglePin}
                  onSelect={setSelectedId}
                />
              )}
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
