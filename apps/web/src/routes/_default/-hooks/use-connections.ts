import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const loaded = await getConnections();
    setConnections(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  const { pinned, unpinned } = useMemo(
    () => ({
      pinned: connections.filter((c) => c.pinned).toSorted(sortByRecency),
      unpinned: connections.filter((c) => !c.pinned).toSorted(sortByRecency),
    }),
    [connections]
  );

  const flatList = useMemo(() => [...pinned, ...unpinned], [pinned, unpinned]);

  const remove = useCallback(
    async (connection: DatabaseConnection) => {
      await deleteConnection(connection.id);
      const updated = await getConnections();
      setConnections(updated);
      toast(`"${connection.name}" deleted`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await saveConnection(connection);
            await load();
          },
        },
        duration: UNDO_DURATION_MS,
      });
    },
    [load]
  );

  const togglePin = useCallback(async (connection: DatabaseConnection) => {
    await togglePinConnection(connection.id);
    const updated = await getConnections();
    setConnections(updated);
  }, []);

  return {
    connections,
    flatList,
    isLoading,
    pinned,
    refresh,
    remove,
    togglePin,
    unpinned,
  };
};
