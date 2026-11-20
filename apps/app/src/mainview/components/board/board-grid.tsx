import type { KeyboardEvent } from "react";

import { stepSize, TILE_SPANS } from "@conch/rpc";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { Board, BoardTile as BoardTileRecord, TileSize } from "@/lib/ipc";

import { staggerDelay, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { WidgetsById } from "./board-inputs";
import type { BoardRuns } from "./board-runs";
import type { TileHandlers } from "./board-tile";
import type { TileActionId } from "./tile-actions";

import { BoardTile, findTileElement } from "./board-tile";
import { useElementWidth } from "./use-element-width";
import { previewOrder, useTileDrag } from "./use-tile-drag";

const NARROW = 600;
const MEDIUM = 900;
const LIFT_SHADOW = "0 24px 48px -12px oklch(0 0 0 / 0.55)";

export const spanFor = (size: TileSize, width: number): number => {
  if (width > 0 && width < NARROW) {
    return 12;
  }
  if (width > 0 && width < MEDIUM && size !== "wide") {
    return 6;
  }
  return TILE_SPANS[size];
};

export interface GridHandlers {
  onRetry: (tileId: string) => void;
  onAction: (tileId: string, action: TileActionId) => void;
  onView: (tileId: string, view: CardViewKind) => void;
  onMove: (from: number, to: number) => void;
  onResize: (tileId: string, size: TileSize) => void;
}

export interface GridCues {
  tints: Readonly<Record<string, number>>;
  freshId: string | null;
}

interface BoardGridProps {
  board: Board;
  widgets: WidgetsById;
  runs: BoardRuns;
  editing: boolean;
  cues: GridCues;
  handlers: GridHandlers;
}

const EDIT_STEPS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};
const SIZE_STEPS: Partial<Record<string, 1 | -1>> = {
  ArrowDown: -1,
  ArrowUp: 1,
};

export function BoardGrid({
  board,
  widgets,
  runs,
  editing,
  cues,
  handlers,
}: BoardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(gridRef);
  const { reduced, spring, soft, fadeIn, fadeOut } = useMotionPreset();
  const [focusTileId, setFocusTileId] = useState<string | null>(null);
  const { onMove, onResize } = handlers;
  const tileIds = board.tiles.map((tile) => tile.id);
  const dragging = useTileDrag({ gridRef, onDrop: onMove, reduced, tileIds });
  const tiles = previewOrder(board.tiles, dragging.drag);
  const lifted = dragging.drag?.tileId ?? dragging.settling;

  useLayoutEffect(() => {
    if (focusTileId) {
      findTileElement(focusTileId)?.focus();
    }
  }, [board.tiles, focusTileId]);

  const handleEditKey = useCallback(
    (tileId: string, event: KeyboardEvent<HTMLElement>) => {
      if (!event.altKey) {
        return;
      }
      const index = board.tiles.findIndex((tile) => tile.id === tileId);
      const tile = board.tiles[index];
      const move = EDIT_STEPS[event.key];
      const size = SIZE_STEPS[event.key];
      if (move !== undefined) {
        event.preventDefault();
        setFocusTileId(tileId);
        onMove(index, index + move);
      } else if (size !== undefined && tile) {
        event.preventDefault();
        setFocusTileId(tileId);
        onResize(tileId, stepSize(tile.size, size));
      }
    },
    [board.tiles, onMove, onResize]
  );

  const tileHandlers: TileHandlers = useMemo(
    () => ({
      onAction: handlers.onAction,
      onDragStart: dragging.start,
      onEditKey: handleEditKey,
      onRetry: handlers.onRetry,
      onView: handlers.onView,
    }),
    [
      dragging.start,
      handleEditKey,
      handlers.onAction,
      handlers.onRetry,
      handlers.onView,
    ]
  );

  const layoutTransition = reduced ? { duration: 0 } : spring;

  return (
    <div
      className={cn(
        "relative grid grid-cols-12 items-start",
        editing ? "gap-5" : "gap-4"
      )}
      ref={gridRef}
    >
      <AnimatePresence initial>
        {tiles.map((tile: BoardTileRecord, index) => {
          const isLifted = tile.id === lifted;
          return (
            <motion.div
              animate={{
                opacity: 1,
                scale: dragging.drag?.tileId === tile.id && !reduced ? 1.02 : 1,
                ...(isLifted ? {} : { y: 0 }),
              }}
              className={cn(
                "relative rounded-[14px] has-[[role=menu]]:z-20",
                isLifted && "z-30"
              )}
              exit={{
                opacity: 0,
                scale: reduced ? 1 : 0.98,
                transition: fadeOut,
              }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              key={tile.id}
              layout={isLifted ? false : "position"}
              style={{
                gridColumn: `span ${spanFor(tile.size, width)} / span ${spanFor(tile.size, width)}`,
                ...(isLifted ? { x: dragging.x, y: dragging.y } : {}),
              }}
              transition={{
                layout: layoutTransition,
                opacity: { ...fadeIn, delay: staggerDelay(index) },
                scale: reduced ? { duration: 0 } : spring,
                y: { ...soft, delay: staggerDelay(index) },
              }}
            >
              <motion.span
                animate={{ opacity: isLifted && !reduced ? 1 : 0 }}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[14px]"
                initial={false}
                style={{ boxShadow: LIFT_SHADOW }}
                transition={fadeIn}
              />
              <BoardTile
                cue={{
                  fresh: cues.freshId === tile.id,
                  tint: cues.tints[tile.id] ?? null,
                }}
                editing={editing}
                handlers={tileHandlers}
                run={runs[tile.id]}
                tile={tile}
                widget={widgets.get(tile.widgetId) ?? null}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
