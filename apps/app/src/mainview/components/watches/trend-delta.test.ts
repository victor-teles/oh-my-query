import { describe, expect, it } from "vitest";

import { localTime, makeKpiWidget, makeTrend } from "@/test/watch-fixtures";

import { clockTime, trendDelta } from "./trend-delta";

const { spec } = makeKpiWidget();
const since = clockTime(makeTrend([1, 2]).previous?.at ?? "");

describe("trendDelta", () => {
  it("has nothing to say before two samples", () => {
    expect(trendDelta(null, spec)).toBeNull();
    expect(trendDelta(makeTrend([]), spec)).toBeNull();
    expect(trendDelta(makeTrend([48_200]), spec)).toBeNull();
  });

  it("describes a rise with a sign, an arrow and the time", () => {
    expect(trendDelta(makeTrend([46_000, 48_000]), spec)).toStrictEqual({
      direction: "up",
      label: `Up 4.3% since ${since}`,
      text: "▲ 4.3%",
    });
  });

  it("describes a fall and rounds large changes", () => {
    expect(trendDelta(makeTrend([100, 50]), spec)).toStrictEqual({
      direction: "down",
      label: `Down 50% since ${since}`,
      text: "▼ 50%",
    });
  });

  it("is neutral when nothing changed", () => {
    expect(trendDelta(makeTrend([5, 5]), spec)).toStrictEqual({
      direction: "flat",
      label: `Unchanged since ${since}`,
      text: "→ 0%",
    });
  });

  it("falls back to the absolute change from zero, in the widget's format", () => {
    expect(trendDelta(makeTrend([0, 1200]), spec)?.text).toBe("▲ $1.2k");
  });

  it("ignores samples without a value", () => {
    const trend = makeTrend([1, 2]);
    const latest = {
      at: localTime(9, 3),
      digest: "000000000000000c",
      rowCount: 0,
      value: null,
    };
    expect(trendDelta({ ...trend, latest }, spec)).toBeNull();
  });
});
