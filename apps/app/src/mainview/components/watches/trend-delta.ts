import { formatScalarValue } from "@oh-my-query/rpc";

import type { CardSpec, WidgetTrend } from "@/lib/ipc";

export type TrendDirection = "up" | "down" | "flat";

export interface TrendDelta {
  direction: TrendDirection;
  text: string;
  label: string;
}

const ARROWS: Record<TrendDirection, string> = {
  down: "▼",
  flat: "→",
  up: "▲",
};

const WORDS: Record<TrendDirection, string> = {
  down: "Down",
  flat: "Unchanged",
  up: "Up",
};

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export const clockTime = (iso: string): string => TIME.format(new Date(iso));

const percentText = (percent: number): string =>
  `${Number(Math.abs(percent).toFixed(Math.abs(percent) < 10 ? 1 : 0))}%`;

// A trend needs two samples; with fewer there is nothing honest to compare.
export const trendDelta = (
  trend: WidgetTrend | null | undefined,
  spec: Pick<CardSpec, "formats" | "view">
): TrendDelta | null => {
  const latest = trend?.latest?.value;
  const previous = trend?.previous;
  const before = previous?.value;
  if (
    latest === null ||
    latest === undefined ||
    before === null ||
    before === undefined ||
    !previous
  ) {
    return null;
  }
  const change = latest - before;
  let direction: TrendDirection = "flat";
  if (change > 0) {
    direction = "up";
  } else if (change < 0) {
    direction = "down";
  }
  const amount =
    before === 0
      ? formatScalarValue(spec, Math.abs(change))
      : percentText((change / Math.abs(before)) * 100);
  const since = clockTime(previous.at);
  return {
    direction,
    label:
      direction === "flat"
        ? `Unchanged since ${since}`
        : `${WORDS[direction]} ${amount} since ${since}`,
    text: `${ARROWS[direction]} ${amount}`,
  };
};
