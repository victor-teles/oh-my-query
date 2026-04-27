import { useCallback, useEffect, useState } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import { getHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";

export const useQueryHistory = (connectionId: string) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getHistory(connectionId);
      setEntries(result);
      setError(null);
    } catch (error) {
      setEntries([]);
      setError(
        error instanceof Error ? error.message : "Failed to load query history"
      );
    } finally {
      setIsLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener(HISTORY_UPDATED_EVENT, handler);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, handler);
  }, [refresh]);

  return { entries, error, isLoading, refresh };
};
