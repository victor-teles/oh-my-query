import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Watch, WatchDraft, WatchStatus } from "@/lib/ipc";

import {
  acknowledgeAlert,
  deleteWatch,
  getWatchingPaused,
  listWatches,
  listWatchStatuses,
  onWatchesChanged,
  saveWatch,
  setWatchingPaused,
} from "@/lib/ipc";

export type WatchesLoad = "loading" | "ready" | "error";

interface WatchesState {
  load: WatchesLoad;
  watches: Watch[];
  statuses: Record<string, WatchStatus>;
  paused: boolean;
}

interface WatchesContextValue extends WatchesState {
  refresh: () => Promise<void>;
  save: (draft: WatchDraft) => Promise<Watch>;
  remove: (watchId: string) => Promise<void>;
  acknowledge: (watchId: string) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
}

const WatchesContext = createContext<WatchesContextValue | null>(null);

const INITIAL: WatchesState = {
  load: "loading",
  paused: false,
  statuses: {},
  watches: [],
};

const byWatchId = (statuses: readonly WatchStatus[]) =>
  Object.fromEntries(statuses.map((status) => [status.watchId, status]));

export const watchForWidget = (
  watches: readonly Watch[],
  widgetId: string
): Watch | null => watches.find((watch) => watch.widgetId === widgetId) ?? null;

export function WatchesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WatchesState>(INITIAL);

  const refresh = useCallback(async () => {
    try {
      const [watches, statuses, paused] = await Promise.all([
        listWatches(),
        listWatchStatuses(),
        getWatchingPaused(),
      ]);
      setState({
        load: "ready",
        paused,
        statuses: byWatchId(statuses),
        watches,
      });
    } catch (error) {
      console.error("[watches] could not load", error);
      setState((current) => ({ ...current, load: "error" }));
    }
  }, []);

  useEffect(() => {
    refresh();
    return onWatchesChanged(() => {
      refresh();
    });
  }, [refresh]);

  const save = useCallback(
    async (draft: WatchDraft) => {
      const saved = await saveWatch(draft);
      await refresh();
      return saved;
    },
    [refresh]
  );

  const remove = useCallback(
    async (watchId: string) => {
      await deleteWatch(watchId);
      await refresh();
    },
    [refresh]
  );

  const acknowledge = useCallback(
    async (watchId: string) => {
      await acknowledgeAlert(watchId);
      await refresh();
    },
    [refresh]
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      setState((current) => ({ ...current, paused }));
      try {
        await setWatchingPaused(paused);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ ...state, acknowledge, refresh, remove, save, setPaused }),
    [acknowledge, refresh, remove, save, setPaused, state]
  );

  return <WatchesContext value={value}>{children}</WatchesContext>;
}

export const useWatches = (): WatchesContextValue => {
  const value = use(WatchesContext);
  if (!value) {
    throw new Error("useWatches must be used inside WatchesProvider");
  }
  return value;
};
