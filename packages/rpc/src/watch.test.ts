import { describe, expect, it } from "vitest";

import type { CardSpec } from "./card-spec.ts";
import type { RunLogEntry } from "./watch.ts";

import {
  alertLabel,
  hasUnseenAlert,
  INITIAL_ALERT_STATE,
  intervalPhrase,
  isKpiSpec,
  MAX_SAMPLES,
  newWatchDraft,
  RunSample,
  shortIntervalPhrase,
  timeAgo,
  trendOfEntry,
  Watch,
  WATCH_INTERVAL_MS,
  WatchCondition,
  WatchDraft,
  watchDraftOf,
} from "./watch.ts";

const STAMP = "2026-11-19T09:41:00.000Z";

const watchRecord = (overrides: Partial<Watch> = {}): Watch => ({
  alert: null,
  alertState: INITIAL_ALERT_STATE,
  createdAt: STAMP,
  id: "watch-1",
  interval: "5m",
  menuBar: false,
  paused: false,
  updatedAt: STAMP,
  values: { period: "last30d" },
  version: 1,
  widgetId: "w1",
  ...overrides,
});

const sample = (value: number | null, at = STAMP) => ({
  at,
  digest: "0123456789abcdef",
  rowCount: 1,
  value,
});

const usdKpi: CardSpec = {
  formats: { mrr: { currency: "USD", kind: "currency" } },
  title: "MRR",
  version: 1,
  view: { kind: "kpi", value: "mrr" },
};

describe("watch schema", () => {
  it("accepts a complete watch and round-trips its draft", () => {
    const watch = Watch.parse(watchRecord({ alert: { kind: "hasRows" } }));
    expect(WatchDraft.parse(watchDraftOf(watch))).toStrictEqual({
      alert: { kind: "hasRows" },
      id: "watch-1",
      interval: "5m",
      menuBar: false,
      paused: false,
      values: { period: "last30d" },
      widgetId: "w1",
    });
  });

  it("rejects unknown intervals, versions and non-finite thresholds", () => {
    expect(
      Watch.safeParse(watchRecord({ interval: "2m" as never })).success
    ).toBeFalsy();
    expect(
      Watch.safeParse({ ...watchRecord(), version: 2 }).success
    ).toBeFalsy();
    expect(
      WatchCondition.safeParse({ kind: "below", threshold: Number.NaN }).success
    ).toBeFalsy();
    expect(
      WatchCondition.safeParse({
        kind: "above",
        threshold: Number.POSITIVE_INFINITY,
      }).success
    ).toBeFalsy();
    expect(
      WatchCondition.safeParse({ kind: "below", threshold: 50_000 }).success
    ).toBeTruthy();
  });

  it("starts a new watch every five minutes with no alert, unpaused", () => {
    const draft = newWatchDraft("w1", { region: "Europe" });
    expect(WatchDraft.parse(draft)).toStrictEqual({
      alert: null,
      interval: "5m",
      menuBar: false,
      paused: false,
      values: { region: "Europe" },
      widgetId: "w1",
    });
  });

  it("validates samples: 16-hex digests and finite values", () => {
    expect(RunSample.safeParse(sample(1)).success).toBeTruthy();
    expect(RunSample.safeParse(sample(null)).success).toBeTruthy();
    expect(
      RunSample.safeParse({ ...sample(1), digest: "xyz" }).success
    ).toBeFalsy();
  });

  it("orders intervals from a minute to an hour", () => {
    expect(WATCH_INTERVAL_MS["1m"]).toBe(60_000);
    expect(WATCH_INTERVAL_MS["1h"]).toBe(3_600_000);
    expect(intervalPhrase("5m")).toBe("every 5 minutes");
    expect(shortIntervalPhrase("1h")).toBe("every hour");
  });
});

describe("timeAgo", () => {
  const now = Date.parse(STAMP);
  const minute = 60_000;

  it.each([
    [10_000, "just now"],
    [4 * minute, "4m ago"],
    [3 * 60 * minute, "3h ago"],
    [50 * 60 * minute, "2d ago"],
    [-minute, "just now"],
  ])("%i ms ago reads %s", (elapsed, text) => {
    expect(timeAgo(now - elapsed, now)).toBe(text);
  });
});

describe("trendOfEntry", () => {
  it("keeps the last two samples and the newest twenty non-null values", () => {
    const samples = [
      ...Array.from({ length: MAX_SAMPLES - 1 }, (_, index) => sample(index)),
      sample(null),
    ];
    const entry: RunLogEntry = {
      id: "w1:0123456789abcdef",
      samples,
      valuesKey: "0123456789abcdef",
      widgetId: "w1",
    };
    const trend = trendOfEntry(entry);
    expect(trend.latest?.value).toBeNull();
    expect(trend.previous?.value).toBe(28);
    expect(trend.series).toHaveLength(20);
    expect(trend.series.at(0)).toBe(9);
    expect(trend.series.at(-1)).toBe(28);
  });
});

describe("alerts", () => {
  it("is unseen until opened after it fired", () => {
    expect(hasUnseenAlert(watchRecord())).toBeFalsy();
    const fired = {
      ...INITIAL_ALERT_STATE,
      lastFiredAt: "2026-11-19T10:00:00.000Z",
    };
    expect(hasUnseenAlert(watchRecord({ alertState: fired }))).toBeTruthy();
    expect(
      hasUnseenAlert(
        watchRecord({
          alertState: { ...fired, seenAt: "2026-11-19T10:01:00.000Z" },
        })
      )
    ).toBeFalsy();
    expect(
      hasUnseenAlert(
        watchRecord({
          alertState: { ...fired, seenAt: "2026-11-19T09:00:00.000Z" },
        })
      )
    ).toBeTruthy();
  });

  it("labels each condition in plain words with the widget's formats", () => {
    expect(
      alertLabel("MRR", { kind: "below", threshold: 50_000 }, usdKpi)
    ).toBe("MRR below $50k");
    expect(alertLabel("MRR", { kind: "above", threshold: 12 }, usdKpi)).toBe(
      "MRR above $12"
    );
    expect(alertLabel("Failed payments", { kind: "hasRows" }, usdKpi)).toBe(
      "Failed payments has rows"
    );
    expect(alertLabel("Signups", { kind: "changed" }, usdKpi)).toBe(
      "Signups changed"
    );
  });

  it("knows which specs are KPIs", () => {
    expect(isKpiSpec(usdKpi)).toBeTruthy();
    expect(isKpiSpec({ view: { kind: "table" } })).toBeFalsy();
  });
});
