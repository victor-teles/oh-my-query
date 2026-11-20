import { useCallback, useMemo } from "react";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { ViewHeader } from "@/components/launcher/view-header";
import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { Checkbox } from "@/components/ui/checkbox";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";

import type { WatchRowModel } from "./watch-status-row";

import { useWatchesHotkeys } from "./use-watches-hotkeys";
import { WatchesList } from "./watches-list";
import { useWatches } from "./watches-provider";

const REMOVE_KEYS = ["⌫"] as const;

const watchedCount = (count: number): string =>
  count === 1 ? "1 widget watched" : `${count} widgets watched`;

interface WatchesViewProps {
  onBack: () => void;
  onOpenWatch: (widgetId: string) => void;
}

export function WatchesView({ onBack, onOpenWatch }: WatchesViewProps) {
  const { watches, statuses, load, paused, refresh, remove, setPaused } =
    useWatches();
  const { widgets } = useWidgets();
  const rows = useMemo(
    () =>
      watches.map((watch): WatchRowModel & { id: string } => ({
        id: watch.id,
        status: statuses[watch.id],
        watch,
        widget: widgets.find((widget) => widget.id === watch.widgetId) ?? null,
      })),
    [statuses, watches, widgets]
  );
  const { move, select, selected } = useListSelection(rows);
  const { arm, armed, disarm } = useArmedConfirm();

  const open = useCallback(
    (row: WatchRowModel | null | undefined) => {
      if (row?.widget) {
        onOpenWatch(row.widget.id);
      }
    },
    [onOpenWatch]
  );
  const removeSelected = useCallback(async () => {
    if (!selected) {
      return;
    }
    if (!armed) {
      arm();
      return;
    }
    disarm();
    await remove(selected.watch.id);
  }, [arm, armed, disarm, remove, selected]);
  const moveSelection = useCallback(
    (delta: number) => {
      disarm();
      move(delta);
    },
    [disarm, move]
  );
  const handleKeyDown = useWatchesHotkeys({
    move: moveSelection,
    onOpen: () => open(selected),
    onRemove: removeSelected,
  });
  const runById = useCallback(
    (id: string) => open(rows.find((row) => row.id === id)),
    [open, rows]
  );
  const handlePaused = useCallback(
    (next: boolean) => {
      setPaused(next);
    },
    [setPaused]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Watching" />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-panel-border">
        <SettingRow
          description="Nothing runs in the background while this is on."
          label="Pause all watching"
        >
          <Checkbox
            aria-label="Pause all watching"
            checked={paused}
            disabled={load !== "ready"}
            onCheckedChange={handlePaused}
          />
        </SettingRow>
        <div className="border-t border-panel-border">
          <WatchesList
            handlers={{
              onHover: select,
              onKeyDown: handleKeyDown,
              onRetry: refresh,
              onRun: runById,
            }}
            load={load}
            paused={paused}
            rows={rows}
            selection={{ armed, selectedId: selected?.id ?? null }}
          />
        </div>
      </div>
      <LauncherFooter
        actionLabel={selected?.widget ? "Edit Watch" : null}
        hints={
          selected
            ? [
                {
                  keys: REMOVE_KEYS,
                  label: armed ? "Press again to stop" : "Stop watching",
                },
              ]
            : []
        }
        status={
          <span aria-live="polite">
            {paused ? "Watching is paused" : watchedCount(watches.length)}
          </span>
        }
      />
    </div>
  );
}
