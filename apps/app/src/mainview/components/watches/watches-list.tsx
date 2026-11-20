import type { KeyboardEvent } from "react";

import { RotateCwIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import { optionId } from "@/components/launcher/launcher-row";
import { Pressable } from "@/components/motion/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { staggerDelay, useMotionPreset } from "@/lib/motion";

import type { WatchRowModel } from "./watch-status-row";
import type { WatchesLoad } from "./watches-provider";

import { WatchStatusRow } from "./watch-status-row";

export const WATCHES_LIST_ID = "launcher-watches-list";

interface WatchesListProps {
  load: WatchesLoad;
  rows: readonly WatchRowModel[];
  selection: { selectedId: string | null; armed: boolean };
  paused: boolean;
  handlers: {
    onHover: (id: string) => void;
    onRun: (id: string) => void;
    onRetry: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}

const rowSelection = (
  watchId: string,
  selection: WatchesListProps["selection"]
): "none" | "selected" | "armed" => {
  if (watchId !== selection.selectedId) {
    return "none";
  }
  return selection.armed ? "armed" : "selected";
};

function LoadingRows() {
  const visible = useDelayedVisibility(true);
  return visible ? (
    <div
      aria-label="Loading watches"
      className="flex flex-col gap-2 px-4 py-3"
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-6 motion-reduce:animate-none" key={index} />
      ))}
    </div>
  ) : null;
}

export function WatchesList({
  load,
  rows,
  selection,
  paused,
  handlers,
}: WatchesListProps) {
  const { reduced, fadeIn, fadeOut, spring } = useMotionPreset();
  const focusOnMount = useCallback((node: HTMLDivElement | null) => {
    node?.focus();
  }, []);
  const {
    onHover: handleHover,
    onKeyDown: handleKeyDown,
    onRetry: handleRetry,
    onRun: handleRun,
  } = handlers;
  if (load === "loading" && rows.length === 0) {
    return <LoadingRows />;
  }
  if (load === "error" && rows.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <p className="type-body text-danger-ink" role="alert">
          Watches couldn’t load.
        </p>
        <Pressable
          className="flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
          onClick={handleRetry}
        >
          <RotateCwIcon aria-hidden className="size-3" />
          Retry
        </Pressable>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 type-body text-panel-muted" role="status">
        Nothing watched yet. ⌘K on a widget → Watch…
      </p>
    );
  }
  return (
    <div
      aria-activedescendant={
        selection.selectedId ? optionId(selection.selectedId) : undefined
      }
      aria-label="Watched widgets"
      className="flex flex-col gap-1 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      id={WATCHES_LIST_ID}
      onKeyDown={handleKeyDown}
      ref={focusOnMount}
      role="listbox"
      tabIndex={0}
    >
      <AnimatePresence>
        {rows.map((row, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            data-motion={reduced ? "instant" : "stagger"}
            exit={{ opacity: 0, transition: fadeOut }}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            key={row.watch.id}
            layout="position"
            transition={{
              ...fadeIn,
              delay: reduced ? 0 : staggerDelay(index),
              layout: spring,
            }}
          >
            <WatchStatusRow
              onHover={handleHover}
              onRun={handleRun}
              paused={paused}
              row={row}
              selection={rowSelection(row.watch.id, selection)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
