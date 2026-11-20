import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
} from "react";

import type { BoardTile, ParamValues } from "@/lib/ipc";

import { failureOf } from "@/components/widgets/use-widget-run";
import { cancelWidgetRun, runWidget } from "@/lib/ipc";

import type { WidgetsById } from "./board-inputs";

import { tileValues } from "./board-inputs";
import { boardRunsReducer } from "./board-runs";

export const MAX_CONCURRENT_RUNS = 4;

interface UseBoardRefreshOptions {
  tiles: readonly BoardTile[];
  widgets: WidgetsById;
  sharedValues: ParamValues;
  refreshMs: number | null;
}

interface QueuedRun {
  tileId: string;
  shared: ParamValues | null;
}

const isVisible = () => document.visibilityState === "visible";

const stopOnBun = async (runId: string): Promise<void> => {
  try {
    await cancelWidgetRun(runId);
  } catch (error) {
    console.error("[board] cancel failed", error);
  }
};

export const useBoardRefresh = ({
  tiles,
  widgets,
  sharedValues,
  refreshMs,
}: UseBoardRefreshOptions) => {
  const [runs, dispatch] = useReducer(boardRunsReducer, {});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const queue = useRef<QueuedRun[]>([]);
  const inFlight = useRef(new Map<string, string>());

  const execute = useEffectEvent(async ({ tileId, shared }: QueuedRun) => {
    const tile = tiles.find((item) => item.id === tileId);
    const widget = tile ? widgets.get(tile.widgetId) : undefined;
    if (!widget) {
      return;
    }
    const runId = crypto.randomUUID();
    const values = tileValues(widget, shared ?? sharedValues);
    inFlight.current.set(tileId, runId);
    dispatch({
      action: { runId, type: "start", values },
      tileId,
      type: "tile",
    });
    try {
      const outcome = await runWidget({ runId, values, widgetId: widget.id });
      dispatch({
        action: { outcome, runId, type: "success" },
        tileId,
        type: "tile",
      });
      if (inFlight.current.get(tileId) === runId) {
        setUpdatedAt(Date.now());
      }
    } catch (error) {
      dispatch({
        action: { failure: failureOf(error), runId, type: "failure" },
        tileId,
        type: "tile",
      });
    } finally {
      if (inFlight.current.get(tileId) === runId) {
        inFlight.current.delete(tileId);
      }
      pump();
    }
  });

  const pump = useEffectEvent(() => {
    while (
      inFlight.current.size < MAX_CONCURRENT_RUNS &&
      queue.current.length > 0
    ) {
      const next = queue.current.shift();
      if (next) {
        execute(next);
      }
    }
  });

  const refresh = useCallback(
    (tileIds: readonly string[], shared: ParamValues | null = null) => {
      for (const tileId of tileIds) {
        const running = inFlight.current.get(tileId);
        if (running) {
          inFlight.current.delete(tileId);
          stopOnBun(running);
        }
      }
      queue.current = [
        ...queue.current.filter((run) => !tileIds.includes(run.tileId)),
        ...tileIds.map((tileId) => ({ shared, tileId })),
      ];
      pump();
    },
    []
  );

  const tileIds = tiles.map((tile) => tile.id);
  const tileKey = tileIds.join(",");

  const refreshAll = () => refresh(tileIds);

  const syncTiles = useEffectEvent(() => {
    dispatch({ keep: tileIds, type: "prune" });
    queue.current = queue.current.filter((run) => tileIds.includes(run.tileId));
    const fresh = tileIds.filter(
      (id) => !(id in runs) && !inFlight.current.has(id)
    );
    if (fresh.length > 0) {
      refresh(fresh);
    }
  });

  useEffect(() => {
    syncTiles();
  }, [tileKey]);

  const tick = useEffectEvent(() => {
    if (isVisible()) {
      refresh(tileIds);
    }
  });

  const catchUp = useEffectEvent(() => {
    const stale =
      updatedAt === null ||
      refreshMs === null ||
      Date.now() - updatedAt >= refreshMs;
    if (isVisible() && refreshMs !== null && stale) {
      refresh(tileIds);
    }
  });

  useEffect(() => {
    if (refreshMs === null) {
      return;
    }
    const timer = window.setInterval(tick, refreshMs);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [refreshMs]);

  useEffect(
    () => () => {
      queue.current = [];
      for (const runId of inFlight.current.values()) {
        stopOnBun(runId);
      }
      inFlight.current.clear();
    },
    []
  );

  return { refresh, refreshAll, runs, updatedAt };
};

export type BoardRefresh = ReturnType<typeof useBoardRefresh>;
