import type { DatabaseConnection } from "@/lib/connections";
import type { WidgetRunResult } from "@/lib/ipc";

import { ConnectionGlyph } from "@/components/launcher/connections/connection-glyph";
import { SwapText } from "@/components/motion/swap-text";
import { formatCount, formatDuration } from "@/lib/format-metrics";

interface WidgetRunMetaProps {
  connection: DatabaseConnection | null;
  outcome: WidgetRunResult | null;
}

export const runMetrics = (outcome: WidgetRunResult): string => {
  const { rowCount, executionTimeMs } = outcome.result;
  const rows = `${formatCount(rowCount)} ${rowCount === 1 ? "row" : "rows"}`;
  return `${rows} · ${formatDuration(executionTimeMs)}`;
};

export function WidgetRunMeta({ connection, outcome }: WidgetRunMetaProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-4 type-meta text-panel-muted tabular-nums">
      {connection ? (
        <>
          <ConnectionGlyph
            className="size-4 rounded-[5px] text-[10px]"
            connection={connection}
          />
          <span className="truncate">{connection.name}</span>
        </>
      ) : (
        <span>No connection</span>
      )}
      {outcome ? (
        <>
          <span aria-hidden>·</span>
          <SwapText value={runMetrics(outcome)} />
        </>
      ) : null}
    </div>
  );
}
