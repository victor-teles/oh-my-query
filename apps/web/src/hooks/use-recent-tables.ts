import { useCallback, useEffect, useState } from "react";

import {
  getRecentTables,
  RECENT_TABLES_LIMIT,
  saveRecentTables,
} from "@/lib/recent-tables";

export const useRecentTables = (connectionId: string) => {
  const [recentTables, setRecentTables] = useState<string[]>(() =>
    getRecentTables(connectionId)
  );

  useEffect(() => {
    setRecentTables(getRecentTables(connectionId));
  }, [connectionId]);

  const markUsed = useCallback(
    (tableName: string) => {
      if (!tableName) {
        return;
      }
      setRecentTables((prev) => {
        const next = [tableName, ...prev.filter((t) => t !== tableName)].slice(
          0,
          RECENT_TABLES_LIMIT
        );
        saveRecentTables(connectionId, next);
        return next;
      });
    },
    [connectionId]
  );

  return { markUsed, recentTables };
};
