import { AnimatePresence } from "motion/react";

import type { Watch, WatchStatus, Widget } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { SwapText } from "@/components/motion/swap-text";
import { cn } from "@/lib/utils";

import { glyphKindOf, WatchGlyph } from "./watch-glyph";
import { statusLine } from "./watch-status-copy";

export interface WatchRowModel {
  watch: Watch;
  widget: Widget | null;
  status: WatchStatus | undefined;
}

interface WatchStatusRowProps {
  row: WatchRowModel;
  paused: boolean;
  selection: "none" | "selected" | "armed";
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function WatchStatusRow({
  row,
  paused,
  selection,
  onHover,
  onRun,
}: WatchStatusRowProps) {
  const { watch, widget, status } = row;
  const line = statusLine(watch, status, paused);
  const failing = status?.state === "error" && !paused;
  return (
    <LauncherRow
      id={watch.id}
      onHover={onHover}
      onRun={onRun}
      selected={selection !== "none"}
      tone={selection === "armed" ? "destructive" : "default"}
    >
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover">
        <WatchGlyph kind={glyphKindOf(watch)} />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">
          {widget?.name ?? "Deleted widget"}
        </span>
        <SwapText
          className={cn(
            "truncate type-meta",
            failing ? "text-danger-ink" : "text-panel-muted"
          )}
          value={
            selection === "armed" ? "Press ⌫ again to stop watching" : line
          }
        />
      </span>
      {status?.display ? (
        <span className="relative shrink-0 type-meta text-foreground tabular-nums">
          {status.display}
        </span>
      ) : null}
      <span className="absolute inset-x-2.5 bottom-0 h-0.5">
        <AnimatePresence>
          {status?.state === "running" ? <ProgressHairline /> : null}
        </AnimatePresence>
      </span>
    </LauncherRow>
  );
}
