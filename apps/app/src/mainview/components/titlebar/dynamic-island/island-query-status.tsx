import { AlertTriangle, Check, X } from "lucide-react";

import type { RunningQueryEntry } from "@/contexts/island-context";

import { IslandErrorMessage } from "./island-error-message";
import { IslandRunningQueriesPicker } from "./island-running-queries-picker";

interface QueryRunningStatusProps {
  runners: RunningQueryEntry[];
  headlineTabId: string;
  onCancelAll: () => void;
}

export const QueryRunningStatus = ({
  runners,
  headlineTabId,
  onCancelAll,
}: QueryRunningStatusProps) => (
  <IslandRunningQueriesPicker
    headlineTabId={headlineTabId}
    onCancelAll={onCancelAll}
    runners={runners}
  />
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
      <Check aria-hidden="true" className="size-3 shrink-0 text-success" />
      <span className="sr-only">
        Query returned {rowCount} {rowLabel} in {timeLabel}
      </span>
      <span
        aria-hidden="true"
        className="
          flex items-baseline gap-1 text-xs font-medium tracking-tight
          text-muted-foreground tabular-nums
        "
      >
        <span className="text-foreground">{rowCount}</span>
        <span className="text-muted-foreground/70">{rowLabel}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground/70">{timeLabel}</span>
      </span>
    </>
  );
};

interface QueryErrorStatusProps {
  error: string;
}

export const QueryErrorStatus = ({ error }: QueryErrorStatusProps) => (
  <>
    <AlertTriangle
      aria-hidden="true"
      className="size-3 shrink-0 text-destructive"
    />
    <span className="sr-only">Query failed: </span>
    <IslandErrorMessage error={error} maxWidthClass="max-w-[360px]" />
  </>
);

export const QueryCancelledStatus = () => (
  <>
    <X aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
    <span className="sr-only">Query cancelled</span>
    <span
      aria-hidden="true"
      className="text-xs font-medium tracking-tight text-muted-foreground"
    >
      Cancelled
    </span>
  </>
);
