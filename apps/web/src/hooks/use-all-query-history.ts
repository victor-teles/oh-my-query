import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HistoryEntry, HistoryFilters } from "@/lib/persistence";

import { getAllHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";

export const useAllQueryHistory = (filters: HistoryFilters) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilters = useMemo(() => filters, [filtersKey]);

  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    requestIdRef.current += 1;
    const id = requestIdRef.current;
    setIsLoading(true);
    try {
      const result = await getAllHistory(stableFilters);
      if (id !== requestIdRef.current) {
        return;
      }
      setEntries(result);
      setError(null);
    } catch (error) {
      if (id !== requestIdRef.current) {
        return;
      }
      setEntries([]);
      setError(
        error instanceof Error ? error.message : "Failed to load query history"
      );
    } finally {
      if (id === requestIdRef.current) {
        setIsLoading(false);
      }
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
