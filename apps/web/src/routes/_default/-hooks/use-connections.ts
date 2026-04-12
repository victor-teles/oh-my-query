import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DatabaseConnection } from "@/lib/connections";

import {
  deleteConnection,
  getConnections,
  saveConnection,
  togglePinConnection,
} from "@/lib/connections";

const UNDO_DURATION_MS = 5000;

const sortByRecency = (a: DatabaseConnection, b: DatabaseConnection) => {
  const aTime = a.lastConnectedAt ? new Date(a.lastConnectedAt).getTime() : 0;
  const bTime = b.lastConnectedAt ? new Date(b.lastConnectedAt).getTime() : 0;
  return bTime - aTime;
};

export const useConnections = () => {
  const [connections, setConnections] = useState(getConnections);

  const refresh = useCallback(() => {
    setConnections(getConnections());
  }, []);

  const { pinned, unpinned } = useMemo(
    () => ({
      pinned: connections.filter((c) => c.pinned).toSorted(sortByRecency),
      unpinned: connections.filter((c) => !c.pinned).toSorted(sortByRecency),
    }),
    [connections]
  );

  const flatList = useMemo(() => [...pinned, ...unpinned], [pinned, unpinned]);

  const remove = useCallback((connection: DatabaseConnection) => {
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

  const togglePin = useCallback((connection: DatabaseConnection) => {
    togglePinConnection(connection.id);
    setConnections(getConnections());
  }, []);

  return {
    connections,
    flatList,
    pinned,
    refresh,
    remove,
    togglePin,
    unpinned,
  };
};
