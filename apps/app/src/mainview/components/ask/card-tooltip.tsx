import { formatValue } from "@conch/rpc";

import type { ChartModel } from "@/lib/card-data";

interface TooltipEntry {
  dataKey?: string | number;
  value?: unknown;
  payload?: { key?: unknown };
}

// Pie slices carry their series key on the datum; cartesian series on dataKey.
const seriesKeyOf = (entry: TooltipEntry): string =>
  typeof entry.payload?.key === "string"
    ? entry.payload.key
    : String(entry.dataKey);

interface CardTooltipProps {
  model: ChartModel;
  active?: boolean;
  label?: unknown;
  payload?: readonly TooltipEntry[];
}

export function CardTooltip({
  model,
  active,
  label,
  payload,
}: CardTooltipProps) {
  if (!(active && payload?.length)) {
    return null;
  }
  const values = new Map(
    payload.map((entry) => [seriesKeyOf(entry), entry.value])
  );
  return (
    <div className="grid min-w-36 animate-in gap-1.5 rounded-[8px] popover-material px-2.5 py-2 type-meta duration-150 fade-in-0">
      {label === undefined ? null : (
        <div className="text-foreground">
          {formatValue(label, model.xFormat)}
        </div>
      )}
      {model.data.series
        .filter((series) => values.has(series.key))
        .map((series) => (
          <div className="flex items-center gap-2" key={series.key}>
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="flex-1 text-panel-muted">{series.label}</span>
            <span className="text-foreground tabular-nums">
              {formatValue(
                values.get(series.key),
                model.yFormat,
                model.context
              )}
            </span>
          </div>
        ))}
    </div>
  );
}
