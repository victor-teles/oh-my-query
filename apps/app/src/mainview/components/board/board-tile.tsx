import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import { GripVerticalIcon, MoreHorizontalIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useState } from "react";

import type { WidgetRunState } from "@/components/widgets/widget-run-reducer";
import type { CardViewKind } from "@/lib/card-data";
import type { BoardTile as BoardTileRecord, Widget } from "@/lib/ipc";

import { ErrorNotice } from "@/components/ask/error-notice";
import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { WidgetTrend } from "@/components/watches/widget-trend";
import { runSpec } from "@/components/widgets/run-spec";
import { failureCopy } from "@/components/widgets/widget-error";
import { WidgetRunBody } from "@/components/widgets/widget-run-body";
import { initialWidgetRun } from "@/components/widgets/widget-run-reducer";

import type { TileActionId } from "./tile-actions";

import { nextSize, SIZE_LABELS, tileActions } from "./tile-actions";
import { TileCue } from "./tile-cue";

export interface TileHandlers {
  onRetry: (tileId: string) => void;
  onAction: (tileId: string, action: TileActionId) => void;
  onView: (tileId: string, view: CardViewKind) => void;
  onEditKey: (tileId: string, event: KeyboardEvent<HTMLElement>) => void;
  onDragStart: (tileId: string, event: PointerEvent<HTMLElement>) => void;
}

export interface TileCueState {
  tint: number | null;
  fresh: boolean;
}

interface BoardTileProps {
  tile: BoardTileRecord;
  widget: Widget | null;
  run: WidgetRunState | undefined;
  editing: boolean;
  cue: TileCueState;
  handlers: TileHandlers;
}

export const tileElementId = (tileId: string) => `board-tile-${tileId}`;

export const findTileElement = (tileId: string) =>
  document.querySelector<HTMLElement>(`#${CSS.escape(tileElementId(tileId))}`);
const menuAnchorId = (tileId: string) => `board-tile-menu-${tileId}`;

interface TileControlsProps {
  tile: BoardTileRecord;
  name: string;
  editing: boolean;
  onMenu: () => void;
  onDragStart: (tileId: string, event: PointerEvent<HTMLElement>) => void;
  onCycleSize: (tileId: string) => void;
}

function TileControls({
  tile,
  name,
  editing,
  onMenu,
  onDragStart,
  onCycleSize,
}: TileControlsProps) {
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => onDragStart(tile.id, event),
    [onDragStart, tile.id]
  );
  const handleCycleSize = useCallback(
    () => onCycleSize(tile.id),
    [onCycleSize, tile.id]
  );
  return (
    <div className="flex items-center gap-1">
      <AnimatePresence initial={false}>
        {editing ? (
          <Reveal className="flex items-center gap-1" key="edit">
            <Pressable
              aria-label={`Size: ${SIZE_LABELS[tile.size]}. Change size`}
              className="h-6 rounded-[6px] bg-row-hover px-1.5 type-micro text-panel-muted hover:bg-row-active hover:text-foreground"
              onClick={handleCycleSize}
            >
              {SIZE_LABELS[tile.size]}
            </Pressable>
            <button
              aria-label={`Drag ${name} to reorder`}
              className="grid size-7 cursor-grab touch-none place-items-center rounded-[7px] text-panel-muted hover:bg-row-hover hover:text-foreground active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              type="button"
            >
              <GripVerticalIcon aria-hidden className="size-4" />
            </button>
          </Reveal>
        ) : null}
      </AnimatePresence>
      <Pressable
        aria-label={`Actions for ${name}`}
        className="grid size-7 place-items-center rounded-[7px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        id={menuAnchorId(tile.id)}
        onClick={onMenu}
      >
        <MoreHorizontalIcon aria-hidden className="size-4" />
      </Pressable>
    </div>
  );
}

interface TileBodyProps {
  widget: Widget | null;
  run: WidgetRunState | undefined;
  view: CardViewKind;
  controls: ReactNode;
  onRetry: () => void;
  onView: (view: CardViewKind) => void;
}

const PENDING_RUN = initialWidgetRun({});

function TileBody({
  widget,
  run,
  view,
  controls,
  onRetry,
  onView,
}: TileBodyProps) {
  if (!widget) {
    return (
      <TileFallback controls={controls} title="Deleted widget">
        <p className="px-4 pb-4 type-meta text-panel-muted">
          This widget no longer exists. Remove it from the board.
        </p>
      </TileFallback>
    );
  }
  if (run?.status === "error" && run.failure) {
    const copy = failureCopy(run.failure);
    return (
      <TileFallback controls={controls} title={widget.name}>
        <ErrorNotice
          action={{ label: "Retry", onRun: onRetry }}
          detail={copy.showDetail ? run.failure.message : null}
          title={copy.title}
        />
      </TileFallback>
    );
  }
  if (!run?.outcome) {
    return (
      <TileFallback controls={controls} title={widget.name}>
        <WidgetRunBody
          onSelectView={onView}
          run={run ?? PENDING_RUN}
          spec={widget.spec}
          view={view}
        />
      </TileFallback>
    );
  }
  return (
    <WidgetRunBody
      onSelectView={onView}
      run={run}
      slots={{
        actions: (
          <>
            <WidgetTrend
              spec={widget.spec}
              trend={run.outcome.trend}
              widgetId={widget.id}
            />
            {controls}
          </>
        ),
      }}
      spec={runSpec(widget, run.outcome.values)}
      view={view}
    />
  );
}

interface TileFallbackProps {
  title: string;
  controls: ReactNode;
  children: ReactNode;
}

function TileFallback({ title, controls, children }: TileFallbackProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <h3 className="truncate type-title text-foreground">{title}</h3>
        {controls}
      </div>
      {children}
    </div>
  );
}

export function BoardTile({
  tile,
  widget,
  run,
  editing,
  cue,
  handlers,
}: BoardTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = widget?.name ?? "Deleted widget";
  const view = tile.view ?? widget?.view ?? "table";
  const actions = tileActions(tile.size, Boolean(run?.outcome));
  const { onAction, onDragStart, onEditKey, onRetry, onView } = handlers;

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const runAction = useCallback(
    (action: { id: TileActionId }) => {
      setMenuOpen(false);
      onAction(tile.id, action.id);
    },
    [onAction, tile.id]
  );
  const retry = useCallback(() => onRetry(tile.id), [onRetry, tile.id]);
  const cycleSize = useCallback(
    () => onAction(tile.id, `size-${nextSize(tile.size)}`),
    [onAction, tile.id, tile.size]
  );
  const selectView = useCallback(
    (next: CardViewKind) => onView(tile.id, next),
    [onView, tile.id]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (editing && event.target === event.currentTarget) {
        onEditKey(tile.id, event);
      }
    },
    [editing, onEditKey, tile.id]
  );

  return (
    <>
      <article
        aria-label={name}
        className="relative flex h-full flex-col overflow-hidden rounded-[14px] border border-panel-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        id={tileElementId(tile.id)}
        onKeyDown={handleKeyDown}
        tabIndex={editing ? 0 : -1}
      >
        <TileCue cue={cue} />
        <TileBody
          controls={
            <TileControls
              editing={editing}
              name={name}
              onCycleSize={cycleSize}
              onDragStart={onDragStart}
              onMenu={openMenu}
              tile={tile}
            />
          }
          onRetry={retry}
          onView={selectView}
          run={run}
          view={view}
          widget={widget}
        />
      </article>
      <AnimatePresence>
        {menuOpen ? (
          <div
            className="absolute top-9 right-0 z-40 w-[17.5rem]"
            style={{ height: actionsMenuHeight(actions.length) }}
          >
            <ActionsMenu
              actions={actions}
              anchorId={menuAnchorId(tile.id)}
              armedId={null}
              onClose={closeMenu}
              onRun={runAction}
              title={name}
            />
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
