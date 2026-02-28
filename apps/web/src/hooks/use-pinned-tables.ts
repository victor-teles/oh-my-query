import { useCallback, useState } from "react";

import { getPinnedTables, savePinnedTables } from "@/lib/pinned-tables";

export const usePinnedTables = (connectionId: string) => {
  const [pinnedTables, setPinnedTables] = useState<string[]>(() =>
    getPinnedTables(connectionId)
  );

  const togglePin = useCallback(
    (tableName: string) => {
      setPinnedTables((prev) => {
        const next = prev.includes(tableName)
          ? prev.filter((t) => t !== tableName)
          : [...prev, tableName];
        savePinnedTables(connectionId, next);
        return next;
      });
    },
    [connectionId]
  );

  const isPinned = useCallback(
    (tableName: string) => pinnedTables.includes(tableName),
    [pinnedTables]
  );

  return { isPinned, pinnedTables, togglePin };
};
