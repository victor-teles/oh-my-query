import type { Variants } from "motion/react";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";

import { IslandErrorMessage } from "./island-error-message";
import { ISLAND_ITEM_TRANSITION, ISLAND_ITEM_VARIANTS } from "./island-motion";

const CHECK_VARIANTS: Variants = {
  hidden: { filter: "blur(4px)", opacity: 0, scale: 0.4 },
  visible: { filter: "blur(0px)", opacity: 1, scale: 1 },
};

const CHECK_TRANSITION = {
  damping: 18,
  mass: 0.5,
  stiffness: 520,
  type: "spring",
} as const;

export const QueryRunningStatus = () => (
  <>
    <motion.span
      aria-hidden="true"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
    </motion.span>
    <span className="sr-only">Executing query</span>
    <motion.span
      aria-hidden="true"
      className="text-chrome text-muted-foreground"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      Executing…
    </motion.span>
  </>
);

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
        className="text-data flex items-baseline gap-1 text-[11px] text-muted-foreground"
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
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      <AlertTriangle className="size-3 shrink-0 text-destructive" />
    </motion.span>
    <span className="sr-only">Query failed: </span>
    <IslandErrorMessage error={error} maxWidthClass="max-w-[360px]" />
  </>
);
