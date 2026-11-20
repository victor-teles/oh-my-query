import { useCallback, useEffect, useState } from "react";

import type { RecentAsk } from "@/lib/ipc";

import { useWidgets } from "@/components/widgets/widgets-provider";
import { clearRecentAsks, deleteRecentAsk, listRecentAsks } from "@/lib/ipc";

export type HistoryStatus = "loading" | "ready" | "error";

interface UseHistoryOptions {
  clearOutMs: number;
}

export const useHistory = ({ clearOutMs }: UseHistoryOptions) => {
  const { refresh } = useWidgets();
  const [asks, setAsks] = useState<RecentAsk[]>([]);
  const [status, setStatus] = useState<HistoryStatus>("loading");
  const [version, setVersion] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await listRecentAsks();
        if (!cancelled) {
          setAsks(next);
          setStatus("ready");
        }
      } catch (error) {
        console.error("[history] could not load", error);
        if (!cancelled) {
          setStatus("error");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (!clearing) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAsks([]);
      setClearing(false);
    }, clearOutMs);
    return () => window.clearTimeout(timer);
  }, [clearOutMs, clearing]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const retry = useCallback(() => {
    setStatus("loading");
    reload();
  }, [reload]);

  const remove = useCallback(
    async (askId: string) => {
      setAsks((current) => current.filter((ask) => ask.id !== askId));
      try {
        await deleteRecentAsk(askId);
      } catch (error) {
        reload();
        throw error;
      }
      refresh();
    },
    [refresh, reload]
  );

  const clear = useCallback(async () => {
    await clearRecentAsks();
    setClearing(true);
    refresh();
  }, [refresh]);

  return { asks, clear, clearing, remove, retry, status };
};

export type HistoryState = ReturnType<typeof useHistory>;
