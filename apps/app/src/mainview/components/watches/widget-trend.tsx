import type { CardSpec, WidgetTrend as WidgetTrendData } from "@/lib/ipc";

import { SwapText } from "@/components/motion/swap-text";
import { cn } from "@/lib/utils";

import type { TrendDirection } from "./trend-delta";

import { Sparkline } from "./sparkline";
import { clockTime, trendDelta } from "./trend-delta";

const TONES: Record<TrendDirection, string> = {
  down: "text-danger-ink",
  flat: "text-panel-muted",
  up: "text-success-ink",
};

export interface TrendFailure {
  since: string | null;
}

interface WidgetTrendProps {
  widgetId: string;
  trend: WidgetTrendData | null | undefined;
  spec: Pick<CardSpec, "formats" | "view">;
  failure?: TrendFailure | null;
}

export function WidgetTrend({
  widgetId,
  trend,
  spec,
  failure = null,
}: WidgetTrendProps) {
  if (failure) {
    return (
      <span className="relative shrink-0 type-meta text-panel-muted tabular-nums">
        {failure.since
          ? `Couldn't refresh since ${clockTime(failure.since)}`
          : "Couldn't refresh"}
      </span>
    );
  }
  const delta = trendDelta(trend, spec);
  if (!(delta && trend?.latest)) {
    return null;
  }
  return (
    <span
      className="relative flex shrink-0 items-center gap-1.5"
      data-testid="widget-trend"
    >
      {trend.series.length > 1 ? (
        <Sparkline
          sampleKey={trend.latest.at}
          seriesKey={`${widgetId}:${trend.valuesKey}`}
          values={trend.series}
        />
      ) : null}
      <span
        aria-label={delta.label}
        className={cn("type-meta tabular-nums", TONES[delta.direction])}
        data-direction={delta.direction}
        role="img"
      >
        <SwapText value={delta.text} />
      </span>
    </span>
  );
}
