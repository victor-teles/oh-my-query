import {
  moveTile,
  REFRESH_MS,
  removeTile,
  resizeTile,
  setTileView,
} from "@oh-my-query/rpc";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { Board, ParamValues, RefreshInterval, TileSize } from "@/lib/ipc";

import { useLauncherAccelerator } from "@/components/launcher/use-launcher-accelerator";
import { Pressable } from "@/components/motion/pressable";
import { copyText } from "@/lib/clipboard";
import { openWidgetInLauncher, toggleLauncher } from "@/lib/ipc";

import type { GridHandlers } from "./board-grid";
import type { BoardHeaderActions } from "./board-header";
import type { WidgetsById } from "./board-inputs";
import type { TileActionId } from "./tile-actions";

import { BoardEmpty } from "./board-empty";
import { BoardFilters } from "./board-filters";
import { BoardGrid } from "./board-grid";
import { BoardHeader } from "./board-header";
import {
  changedKeys,
  filterValues,
  sharedInputs,
  tilesAffectedBy,
} from "./board-inputs";
import { BoardMessage } from "./board-message";
import { sizeOfAction } from "./tile-actions";
import { useBoardData } from "./use-board-data";
import { useBoardHotkeys } from "./use-board-hotkeys";
import { useBoardRefresh } from "./use-board-refresh";
import { useFreshTile } from "./use-fresh-tile";

const useBoardSurface = () => {
  useEffect(() => {
    document.documentElement.dataset.surface = "board";
    return () => {
      delete document.documentElement.dataset.surface;
    };
  }, []);
};

interface BoardScreenProps {
  board: Board;
  widgets: WidgetsById;
  update: (change: (board: Board) => Board) => void;
}

function BoardScreen({ board, widgets, update }: BoardScreenProps) {
  const [editing, setEditing] = useState(false);
  const [tints, setTints] = useState<Record<string, number>>({});
  const refresh = useBoardRefresh({
    refreshMs: REFRESH_MS[board.refresh],
    sharedValues: board.sharedValues,
    tiles: board.tiles,
    widgets,
  });
  const freshId = useFreshTile(board.tiles);
  const inputs = useMemo(() => sharedInputs(board, widgets), [board, widgets]);
  const values = useMemo(
    () => filterValues(inputs, board.sharedValues, widgets),
    [board.sharedValues, inputs, widgets]
  );
  const launcherHotkey = useLauncherAccelerator();
  const { refreshAll } = refresh;
  const toggleEdit = useCallback(() => setEditing((value) => !value), []);

  useBoardHotkeys({
    editing,
    launcherHotkey,
    onLauncher: () => toggleLauncher(board.id),
    onRefresh: refreshAll,
    onToggleEdit: toggleEdit,
  });

  const applyFilters = useCallback(
    (next: ParamValues) => {
      const keys = changedKeys(values, next);
      if (keys.length === 0) {
        return;
      }
      const affected = tilesAffectedBy(inputs, keys);
      const shared = { ...board.sharedValues };
      for (const key of keys) {
        const value = next[key];
        if (value !== undefined) {
          shared[key] = value;
        }
      }
      update((current) => ({ ...current, sharedValues: shared }));
      const token = Date.now();
      setTints(Object.fromEntries(affected.map((id) => [id, token])));
      refresh.refresh(affected, shared);
    },
    [board.sharedValues, inputs, refresh, update, values]
  );

  const headerActions: BoardHeaderActions = useMemo(
    () => ({
      onRefresh: refreshAll,
      onRefreshInterval: (interval: RefreshInterval) =>
        update((current) => ({ ...current, refresh: interval })),
      onRename: (name: string) => update((current) => ({ ...current, name })),
      onToggleEdit: toggleEdit,
    }),
    [refreshAll, toggleEdit, update]
  );

  const gridHandlers: GridHandlers = useMemo(
    () => ({
      onAction: (tileId: string, action: TileActionId) => {
        const tile = board.tiles.find((item) => item.id === tileId);
        const size = sizeOfAction(action);
        if (size) {
          update((current) => resizeTile(current, tileId, size));
        } else if (action === "remove") {
          update((current) => removeTile(current, tileId));
        } else if (action === "open" && tile) {
          openWidgetInLauncher(tile.widgetId);
        } else if (action === "copy-sql") {
          const sql = refresh.runs[tileId]?.outcome?.compiledSql;
          if (sql) {
            copyText(sql);
          }
        }
      },
      onMove: (from: number, to: number) =>
        update((current) => moveTile(current, from, to)),
      onResize: (tileId: string, size: TileSize) =>
        update((current) => resizeTile(current, tileId, size)),
      onRetry: (tileId: string) => refresh.refresh([tileId]),
      onView: (tileId: string, view: CardViewKind) =>
        update((current) => setTileView(current, tileId, view)),
    }),
    [board.tiles, refresh, update]
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <BoardHeader
        actions={headerActions}
        board={board}
        editing={editing}
        updatedAt={refresh.updatedAt}
      />
      <BoardFilters inputs={inputs} onApply={applyFilters} values={values} />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-10">
        {board.tiles.length === 0 ? (
          <BoardEmpty />
        ) : (
          <BoardGrid
            board={board}
            cues={{ freshId, tints }}
            editing={editing}
            handlers={gridHandlers}
            runs={refresh.runs}
            widgets={widgets}
          />
        )}
      </main>
    </div>
  );
}

interface BoardViewProps {
  boardId: string;
}

export function BoardView({ boardId }: BoardViewProps) {
  useBoardSurface();
  const { data, update, reload } = useBoardData(boardId);

  switch (data.status) {
    case "ready": {
      return (
        <BoardScreen
          board={data.board}
          update={update}
          widgets={data.widgets}
        />
      );
    }
    case "missing": {
      return (
        <BoardMessage
          detail="It may have been deleted from the launcher."
          title="This board no longer exists."
        />
      );
    }
    case "error": {
      return (
        <BoardMessage detail={data.message} title="This board could not load.">
          <Pressable
            className="mt-2 h-7 rounded-[7px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active"
            onClick={reload}
          >
            Retry
          </Pressable>
        </BoardMessage>
      );
    }
    default: {
      return <BoardMessage title="Loading board…" />;
    }
  }
}
