import { AlertTriangle, Check, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { IslandCancelButton } from "./island-cancel-button";
import { IslandErrorMessage } from "./island-error-message";
import {
  CANCELLED_TRANSITION,
  CANCELLED_VARIANTS,
  CHECK_TRANSITION,
  CHECK_VARIANTS,
  ERROR_ICON_TRANSITION,
  ERROR_ICON_VARIANTS,
  ISLAND_ITEM_TRANSITION,
  ISLAND_ITEM_VARIANTS,
  RUNNING_PULSE_TRANSITION,
} from "./island-motion";
import { formatElapsed, useElapsedSince } from "./use-elapsed-time";

const ELAPSED_THRESHOLD_MS = 1000;

interface QueryRunningStatusProps {
  startedAt: number;
  onCancel?: () => void;
}

export const QueryRunningStatus = ({
  startedAt,
  onCancel,
}: QueryRunningStatusProps) => {
  const shouldReduceMotion = useReducedMotion();
  const elapsed = useElapsedSince(startedAt);
  const showElapsed = elapsed >= ELAPSED_THRESHOLD_MS;

  return (
    <>
      <motion.span
        animate={
          shouldReduceMotion
            ? undefined
            : { opacity: [0.45, 1, 0.45], scale: [0.85, 1.05, 0.85] }
        }
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-primary"
        initial={{ opacity: 0.7, scale: 0.9 }}
        transition={RUNNING_PULSE_TRANSITION}
      />
      <span className="sr-only">Executing query</span>
      <motion.span
        aria-hidden="true"
        className={cn(
          "text-muted-foreground text-xs font-medium tracking-tight",
          shouldReduceMotion && "font-semibold"
        )}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        Running
      </motion.span>
      {showElapsed && (
        <motion.span
          aria-hidden="true"
          className="tabular-nums text-muted-foreground text-xs font-medium tracking-tight"
          initial={{ filter: "blur(4px)", opacity: 0 }}
          animate={{ filter: "blur(0px)", opacity: 1 }}
          transition={ISLAND_ITEM_TRANSITION}
        >
          {formatElapsed(elapsed)}
        </motion.span>
      )}
      {onCancel && <IslandCancelButton onCancel={onCancel} />}
    </>
  );
};

interface QuerySuccessStatusProps {
  rowCount: number;
  executionTimeMs: number;
}

const formatTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export const QuerySuccessStatus = ({
  rowCount,
  executionTimeMs,
}: QuerySuccessStatusProps) => {
  const rowLabel = rowCount === 1 ? "row" : "rows";
  const timeLabel = formatTime(executionTimeMs);

  return (
    <>
      <motion.span
        aria-hidden="true"
        transition={CHECK_TRANSITION}
        variants={CHECK_VARIANTS}
      >
        <Check className="size-3 shrink-0 text-success" />
      </motion.span>
      <span className="sr-only">
        Query returned {rowCount} {rowLabel} in {timeLabel}
      </span>
      <motion.span
        aria-hidden="true"
        className="flex items-baseline gap-1 tabular-nums text-muted-foreground text-xs font-medium tracking-tight"
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        <span className="text-foreground">{rowCount}</span>
        <span className="text-muted-foreground/70">{rowLabel}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-foreground">{timeLabel}</span>
      </motion.span>
    </>
  );
};

interface QueryErrorStatusProps {
  error: string;
}

export const QueryErrorStatus = ({ error }: QueryErrorStatusProps) => (
  <>
    <motion.span
      aria-hidden="true"
      transition={ERROR_ICON_TRANSITION}
      variants={ERROR_ICON_VARIANTS}
    >
      <AlertTriangle className="size-3 shrink-0 text-destructive" />
    </motion.span>
    <span className="sr-only">Query failed: </span>
    <IslandErrorMessage error={error} maxWidthClass="max-w-[360px]" />
  </>
);

export const QueryCancelledStatus = () => (
  <>
    <motion.span
      aria-hidden="true"
      transition={CANCELLED_TRANSITION}
      variants={CANCELLED_VARIANTS}
    >
      <X className="size-3 shrink-0 text-muted-foreground" />
    </motion.span>
    <span className="sr-only">Query cancelled</span>
    <motion.span
      aria-hidden="true"
      className="text-muted-foreground text-xs font-medium tracking-tight"
      transition={CANCELLED_TRANSITION}
      variants={CANCELLED_VARIANTS}
    >
      Cancelled
    </motion.span>
  </>
);
