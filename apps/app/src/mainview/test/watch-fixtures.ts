import { INITIAL_ALERT_STATE } from "@conch/rpc";

import type { Watch, WatchStatus, Widget, WidgetTrend } from "@/lib/ipc";

import { makeWidget } from "./widget-fixtures";

// Local wall-clock times keep "since 9:41 AM" stable in any time zone.
export const localTime = (hour: number, minute: number): string =>
  new Date(2026, 10, 19, hour, minute).toISOString();

export const makeKpiWidget = (overrides: Partial<Widget> = {}): Widget =>
  makeWidget({
    id: "w-mrr",
    name: "MRR",
    params: [
      {
        default: "last30d",
        label: "Period",
        name: "period",
        type: "dateRange",
      },
    ],
    spec: {
      formats: { mrr: { currency: "USD", kind: "currency" } },
      title: "MRR",
      version: 1,
      view: { kind: "kpi", value: "mrr" },
    },
    view: "kpi",
    ...overrides,
  });

export const makeWatch = (overrides: Partial<Watch> = {}): Watch => ({
  alert: null,
  alertState: INITIAL_ALERT_STATE,
  createdAt: "2026-11-19T09:00:00.000Z",
  id: "watch-mrr",
  interval: "5m",
  menuBar: false,
  paused: false,
  updatedAt: "2026-11-19T09:00:00.000Z",
  values: { period: "last30d" },
  version: 1,
  widgetId: "w-mrr",
  ...overrides,
});

export const firedAlert = (watch: Partial<Watch> = {}): Watch =>
  makeWatch({
    alert: { kind: "below", threshold: 50_000 },
    alertState: {
      armed: false,
      falseStreak: 0,
      lastFiredAt: localTime(9, 41),
      seenAt: null,
    },
    ...watch,
  });

const sampleAt = (minute: number) => localTime(9, minute);

export const makeTrend = (values: number[]): WidgetTrend => ({
  latest:
    values.length > 0
      ? {
          at: sampleAt(values.length),
          digest: "000000000000000a",
          rowCount: 1,
          value: values.at(-1) ?? null,
        }
      : null,
  previous:
    values.length > 1
      ? {
          at: sampleAt(values.length - 1),
          digest: "000000000000000b",
          rowCount: 1,
          value: values.at(-2) ?? null,
        }
      : null,
  series: values,
  valuesKey: "00000000000000aa",
});

export const makeStatus = (
  overrides: Partial<WatchStatus> = {}
): WatchStatus => ({
  display: "$48.2k",
  error: null,
  lastRunAt: localTime(9, 41),
  nextRunAt: localTime(9, 46),
  state: "idle",
  watchId: "watch-mrr",
  ...overrides,
});
