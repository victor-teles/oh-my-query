import { z } from "zod";

import type { CardSpec } from "./card-spec.ts";
import type { ParamValues } from "./widget.ts";

import { formatScalarValue } from "./card-format.ts";
import { ParamValue } from "./widget.ts";

export const WATCH_INTERVALS = ["1m", "5m", "15m", "1h"] as const;
export const WatchInterval = z.enum(WATCH_INTERVALS);
export type WatchInterval = z.infer<typeof WatchInterval>;

const MINUTE_MS = 60_000;

export const WATCH_INTERVAL_MS: Record<WatchInterval, number> = {
  "15m": 15 * MINUTE_MS,
  "1h": 60 * MINUTE_MS,
  "1m": MINUTE_MS,
  "5m": 5 * MINUTE_MS,
};

export const DEFAULT_WATCH_INTERVAL: WatchInterval = "5m";
export const MAX_WATCHES = 20;

export const WatchCondition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("below"), threshold: z.number().finite() }),
  z.object({ kind: z.literal("above"), threshold: z.number().finite() }),
  z.object({ kind: z.literal("hasRows") }),
  z.object({ kind: z.literal("changed") }),
]);
export type WatchCondition = z.infer<typeof WatchCondition>;
export type WatchConditionKind = WatchCondition["kind"];

export const AlertState = z.object({
  armed: z.boolean(),
  falseStreak: z.number().int().min(0),
  lastFiredAt: z.string().nullable(),
  seenAt: z.string().nullable(),
});
export type AlertState = z.infer<typeof AlertState>;

export const INITIAL_ALERT_STATE: AlertState = {
  armed: true,
  falseStreak: 0,
  lastFiredAt: null,
  seenAt: null,
};

const Id = z.string().min(1).max(100);

export const Watch = z.object({
  alert: WatchCondition.nullable(),
  alertState: AlertState,
  createdAt: z.string(),
  id: Id,
  interval: WatchInterval,
  menuBar: z.boolean(),
  paused: z.boolean(),
  updatedAt: z.string(),
  values: z.record(z.string(), ParamValue),
  version: z.literal(1),
  widgetId: Id,
});
export type Watch = z.infer<typeof Watch>;

export const WatchDraft = Watch.pick({
  alert: true,
  interval: true,
  menuBar: true,
  paused: true,
  values: true,
  widgetId: true,
}).extend({ id: Id.optional() });
export type WatchDraft = z.infer<typeof WatchDraft>;

export const newWatchDraft = (
  widgetId: string,
  values: ParamValues
): WatchDraft => ({
  alert: null,
  interval: DEFAULT_WATCH_INTERVAL,
  menuBar: false,
  paused: false,
  values,
  widgetId,
});

export const watchDraftOf = (watch: Watch): WatchDraft => ({
  alert: watch.alert,
  id: watch.id,
  interval: watch.interval,
  menuBar: watch.menuBar,
  paused: watch.paused,
  values: watch.values,
  widgetId: watch.widgetId,
});

const Hex16 = z.string().regex(/^[0-9a-f]{16}$/);

export const RunSample = z.object({
  at: z.string(),
  digest: Hex16,
  rowCount: z.number().int().min(0),
  value: z.number().finite().nullable(),
});
export type RunSample = z.infer<typeof RunSample>;

export const MAX_SAMPLES = 30;
export const MAX_RUN_LOG_ENTRIES_PER_WIDGET = 8;
export const TREND_SERIES_LENGTH = 20;

export const RunLogEntry = z.object({
  id: z.string(),
  samples: z.array(RunSample).max(MAX_SAMPLES),
  valuesKey: Hex16,
  widgetId: z.string(),
});
export type RunLogEntry = z.infer<typeof RunLogEntry>;

export interface WidgetTrend {
  valuesKey: string;
  latest: RunSample | null;
  previous: RunSample | null;
  series: number[];
}

export const trendOfEntry = (entry: RunLogEntry): WidgetTrend => ({
  latest: entry.samples.at(-1) ?? null,
  previous: entry.samples.at(-2) ?? null,
  series: entry.samples
    .map((sample) => sample.value)
    .filter((value): value is number => value !== null)
    .slice(-TREND_SERIES_LENGTH),
  valuesKey: entry.valuesKey,
});

export type WatchState = "idle" | "running" | "error" | "paused" | "waiting";

export interface WatchStatus {
  watchId: string;
  state: WatchState;
  lastRunAt: string | null;
  nextRunAt: string | null;
  error: { code: string; message: string } | null;
  display: string | null;
}

export const hasUnseenAlert = (watch: Pick<Watch, "alertState">): boolean => {
  const { lastFiredAt, seenAt } = watch.alertState;
  return lastFiredAt !== null && (seenAt === null || seenAt < lastFiredAt);
};

export const isKpiSpec = (spec: Pick<CardSpec, "view">): boolean =>
  spec.view.kind === "kpi";

export const formatThreshold = (
  spec: Pick<CardSpec, "formats" | "view">,
  threshold: number
): string => formatScalarValue(spec, threshold);

export const alertLabel = (
  widgetName: string,
  condition: WatchCondition,
  spec: Pick<CardSpec, "formats" | "view">
): string => {
  switch (condition.kind) {
    case "below": {
      return `${widgetName} below ${formatThreshold(spec, condition.threshold)}`;
    }
    case "above": {
      return `${widgetName} above ${formatThreshold(spec, condition.threshold)}`;
    }
    case "hasRows": {
      return `${widgetName} has rows`;
    }
    default: {
      return `${widgetName} changed`;
    }
  }
};

const INTERVAL_PHRASES: Record<WatchInterval, string> = {
  "15m": "every 15 minutes",
  "1h": "every hour",
  "1m": "every minute",
  "5m": "every 5 minutes",
};

export const intervalPhrase = (interval: WatchInterval): string =>
  INTERVAL_PHRASES[interval];

export const timeAgo = (at: number, now: number): string => {
  const minutes = Math.floor(Math.max(0, now - at) / MINUTE_MS);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

const SHORT_INTERVALS: Record<WatchInterval, string> = {
  "15m": "every 15 min",
  "1h": "every hour",
  "1m": "every min",
  "5m": "every 5 min",
};

export const shortIntervalPhrase = (interval: WatchInterval): string =>
  SHORT_INTERVALS[interval];
