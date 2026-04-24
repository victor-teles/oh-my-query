import { useCallback, useEffect, useMemo, useState } from "react";

import type { HistoryEntry, HistoryFilters } from "@/lib/persistence";

import { getAllHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";

export const useAllQueryHistory = (filters: HistoryFilters) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilters = useMemo(() => filters, [filtersKey]);

  const refresh = useCallback(async () => {
    try {
      const result = await getAllHistory(stableFilters);
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
  }, [stableFilters]);

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
