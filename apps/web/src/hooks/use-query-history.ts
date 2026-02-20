import { useCallback, useEffect, useState } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import { getHistory } from "@/lib/persistence";

export const useQueryHistory = (connectionId: string) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getHistory(connectionId);
      setEntries(result);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, isLoading, refresh };
};
