import type { Transition } from "motion/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RunningQueryEntry } from "@/contexts/island-context";

import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getConnectionColorClasses,
  getEnvironmentStyle,
} from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

import { IslandCancelButton } from "./island-cancel-button";
import {
  CONTENT_CROSSFADE_ANIMATE,
  CONTENT_CROSSFADE_INITIAL,
  CONTENT_CROSSFADE_TRANSITION,
  INDICATOR_LOOP_TRANSITION,
} from "./island-motion";
import { formatElapsed, useElapsedSince } from "./use-elapsed-time";

const ELAPSED_THRESHOLD_MS = 1000;

interface IslandRunningQueriesPickerProps {
  runners: RunningQueryEntry[];
  headlineTabId: string;
  onCancelAll: () => void;
}

export const IslandRunningQueriesPicker = ({
  runners,
  headlineTabId,
  onCancelAll,
}: IslandRunningQueriesPickerProps) => {
  const [open, setOpen] = useState(false);
  const headline = runners.find((r) => r.tabId === headlineTabId) ?? runners[0];
  const showFooter = runners.length >= 2;
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (runners.length === 0 && open) {
      setOpen(false);
    }
  }, [runners.length, open]);

  if (!headline) {
    return null;
  }

  return (
    <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
      <PopoverPrimitive.Trigger
        render={
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={
              runners.length === 1
                ? `Show running query (${runners[0]?.tabTitle ?? ""})`
                : `Show ${runners.length} running queries`
            }
            className="
              flex cursor-pointer items-center gap-1.5 rounded-full
              transition-opacity duration-150 ease-out
              hover:opacity-75
              focus-visible:ring-2 focus-visible:ring-ring/50
              focus-visible:outline-none
              active:opacity-55
            "
            type="button"
          >
            <RunningPillContent
              count={runners.length}
              startedAt={headline.startedAt}
            />
          </button>
        }
      />
      {open && (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            align="center"
            className="isolate z-50"
            side="bottom"
            sideOffset={8}
          >
            <PopoverPrimitive.Popup
              aria-label="Running queries"
              className="
                w-90 origin-(--transform-origin) overflow-hidden rounded-xl
                border border-border/60 bg-background/85 p-1 shadow-sm
                backdrop-blur-xl backdrop-saturate-200 outline-none
                data-[side=bottom]:slide-in-from-top-2
                data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
                data-closed:animate-out data-closed:fade-out-0
                data-closed:zoom-out-95
              "
              data-island-picker="true"
            >
              <PickerBody
                onCancelAll={onCancelAll}
                onClose={handleClose}
                runners={runners}
                showFooter={showFooter}
              />
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  );
};

interface RunningPillContentProps {
  startedAt: number;
  count: number;
}

const RunningPillContent = ({ startedAt, count }: RunningPillContentProps) => {
  const shouldReduceMotion = useReducedMotion();
  const elapsed = useElapsedSince(startedAt);
  const showElapsed = elapsed >= ELAPSED_THRESHOLD_MS;
  const showCount = count >= 2;

  return (
    <>
      <motion.span
        animate={
          shouldReduceMotion
            ? undefined
            : { opacity: [0.45, 1], scale: [0.85, 1.05] }
        }
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-primary"
        transition={INDICATOR_LOOP_TRANSITION()}
      />
      <span className="sr-only">Executing query</span>
      <span
        aria-hidden="true"
        className={cn(
          "text-xs font-medium tracking-tight text-muted-foreground",
          shouldReduceMotion && "font-semibold"
        )}
      >
        Running
      </span>
      {showElapsed && (
        <span
          aria-hidden="true"
          className="
            text-xs font-medium tracking-tight text-muted-foreground/70
            tabular-nums
          "
        >
          {formatElapsed(elapsed)}
        </span>
      )}
      {showCount && (
        <span
          aria-hidden="true"
          className="
            rounded-full bg-foreground/10 px-1.5 py-px text-[10px] font-medium
            text-muted-foreground tabular-nums
          "
        >
          +{count - 1}
        </span>
      )}
      <X
        aria-hidden="true"
        className="ml-0.5 size-2.5 shrink-0 text-muted-foreground/70"
      />
    </>
  );
};

interface PickerBodyProps {
  runners: RunningQueryEntry[];
  showFooter: boolean;
  onCancelAll: () => void;
  onClose: () => void;
}

const PickerBody = ({
  runners,
  showFooter,
  onCancelAll,
  onClose,
}: PickerBodyProps) => {
  const [focusedTabId, setFocusedTabId] = useState<string>(
    () => runners[0]?.tabId ?? ""
  );
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const shouldReduceMotion = useReducedMotion();
  const itemTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : CONTENT_CROSSFADE_TRANSITION;

  const tabIds = useMemo(() => runners.map((r) => r.tabId), [runners]);

  useEffect(() => {
    if (!tabIds.includes(focusedTabId)) {
      const [fallback] = tabIds;
      if (fallback) {
        setFocusedTabId(fallback);
      }
    }
  }, [tabIds, focusedTabId]);

  useEffect(() => {
    const node = rowRefs.current.get(focusedTabId);
    node?.focus();
  }, [focusedTabId]);

  const registerRow = useCallback(
    (tabId: string, node: HTMLLIElement | null) => {
      if (node) {
        rowRefs.current.set(tabId, node);
      } else {
        rowRefs.current.delete(tabId);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLUListElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const idx = tabIds.indexOf(focusedTabId);
        if (idx === -1) {
          return;
        }
        const next =
          event.key === "ArrowDown"
            ? tabIds[(idx + 1) % tabIds.length]
            : tabIds[(idx - 1 + tabIds.length) % tabIds.length];
        if (next) {
          setFocusedTabId(next);
        }
      }
    },
    [focusedTabId, tabIds]
  );

  const handleCancelAll = useCallback(() => {
    onCancelAll();
    onClose();
  }, [onCancelAll, onClose]);

  return (
    <div className="flex flex-col">
      <ScrollArea className="max-h-65">
        <ul
          aria-label="Running queries"
          className="flex flex-col gap-px"
          onKeyDown={handleKeyDown}
          role="listbox"
        >
          <AnimatePresence initial={false}>
            {runners.map((runner) => (
              <RunnerRow
                isFocused={runner.tabId === focusedTabId}
                key={runner.tabId}
                onFocusTab={setFocusedTabId}
                registerRef={registerRow}
                runner={runner}
                transition={itemTransition}
              />
            ))}
          </AnimatePresence>
        </ul>
      </ScrollArea>
      {showFooter && (
        <div
          className="
            mt-1 flex items-center justify-between border-t border-border/40
            px-2 pt-2 pb-1
          "
        >
          <button
            className="
              cursor-pointer rounded-sm text-xs font-medium text-destructive
              transition-colors
              hover:text-destructive/80
              focus-visible:ring-2 focus-visible:ring-ring/50
              focus-visible:outline-none
            "
            onClick={handleCancelAll}
            type="button"
          >
            Cancel all
          </button>
          <span
            className="
              flex items-center gap-1 text-[10px] text-muted-foreground/70
            "
          >
            <Kbd className="h-4 px-1 text-[9px]">Esc</Kbd>
            <span>to close</span>
          </span>
        </div>
      )}
    </div>
  );
};

interface RunnerRowProps {
  runner: RunningQueryEntry;
  isFocused: boolean;
  onFocusTab: (tabId: string) => void;
  registerRef: (tabId: string, node: HTMLLIElement | null) => void;
  transition: Transition;
}

const RunnerRow = ({
  runner,
  isFocused,
  onFocusTab,
  registerRef,
  transition,
}: RunnerRowProps) => {
  const elapsed = useElapsedSince(runner.startedAt);
  const colorClasses = getConnectionColorClasses(runner.connectionColor);
  const envStyle = getEnvironmentStyle(runner.connectionEnvironment);
  const handleCancel = useCallback(() => {
    runner.onCancel();
  }, [runner]);
  const { tabId } = runner;
  const setRef = useCallback(
    (node: HTMLLIElement | null) => {
      registerRef(tabId, node);
    },
    [registerRef, tabId]
  );
  const handleFocus = useCallback(() => onFocusTab(tabId), [onFocusTab, tabId]);
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLLIElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleCancel]
  );

  return (
    <motion.li
      animate={CONTENT_CROSSFADE_ANIMATE}
      aria-selected={isFocused}
      className="
        group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors
        duration-150 outline-none
        hover:bg-accent/60
        focus:bg-accent/60
        focus-visible:bg-accent/60
      "
      data-tab-id={runner.tabId}
      exit={CONTENT_CROSSFADE_INITIAL}
      initial={CONTENT_CROSSFADE_INITIAL}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleFocus}
      ref={setRef}
      role="option"
      tabIndex={isFocused ? 0 : -1}
      transition={transition}
    >
      <span
        aria-hidden="true"
        className="
          size-1.5 shrink-0 rounded-full bg-primary
          motion-safe:animate-pulse
        "
      />
      <span
        className="
          min-w-0 flex-1 truncate text-xs font-medium tracking-tight
          text-foreground
        "
      >
        {runner.tabTitle}
      </span>
      {envStyle && (
        <Badge
          className={cn("h-4 px-1 text-[9px]", envStyle.badgeClass)}
          variant="outline"
        >
          {envStyle.label}
        </Badge>
      )}
      <span
        className="
          inline-flex max-w-24 shrink-0 items-center gap-1 text-[10px]
          text-muted-foreground
        "
      >
        {colorClasses && (
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", colorClasses.dot)}
          />
        )}
        {runner.connectionEmoji && (
          <span aria-hidden="true">{runner.connectionEmoji}</span>
        )}
        <span className="truncate">{runner.connectionLabel}</span>
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground/80 tabular-nums">
        {formatElapsed(elapsed)}
      </span>
      <IslandCancelButton
        keyShortcut={null}
        label={`Cancel ${runner.tabTitle}`}
        onCancel={handleCancel}
        title={`Cancel ${runner.tabTitle}`}
      />
    </motion.li>
  );
};
