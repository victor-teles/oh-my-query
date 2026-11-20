import { describe, expect, it } from "vitest";

import {
  firedAlert,
  localTime,
  makeKpiWidget,
  makeWatch,
} from "@/test/watch-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { alertsOf } from "./use-alerts";
import {
  draftOfForm,
  editableValues,
  initialWatchForm,
  needsThreshold,
  parseThreshold,
  watchFormReducer,
} from "./use-watch-form";
import { watchActions } from "./watch-actions";
import { glyphKindOf } from "./watch-glyph";

const kpi = makeKpiWidget({ lastValues: { period: "last7d" } });

describe("watch form", () => {
  it("starts a new watch from the widget's last inputs with defaults", () => {
    expect(initialWatchForm(kpi, null)).toStrictEqual({
      condition: "none",
      interval: "5m",
      menuBar: false,
      save: { kind: "idle" },
      threshold: "",
      values: { period: "last7d" },
    });
  });

  it("edits an existing watch as it was saved", () => {
    const watch = makeWatch({
      alert: { kind: "above", threshold: 9 },
      interval: "1m",
      menuBar: true,
    });
    expect(initialWatchForm(kpi, watch)).toMatchObject({
      condition: "above",
      interval: "1m",
      menuBar: true,
      threshold: "9",
      values: { period: "last30d" },
    });
  });

  it("keeps fixed inputs out of the snapshot", () => {
    const widget = makeWidget({
      params: [
        {
          default: "Europe",
          fixed: true,
          label: "Region",
          name: "region",
          type: "text",
        },
      ],
    });
    expect(editableValues(widget)).toStrictEqual({});
  });

  it("reduces each field independently", () => {
    let state = initialWatchForm(kpi, null);
    state = watchFormReducer(state, { interval: "15m", type: "interval" });
    state = watchFormReducer(state, { menuBar: true, type: "menuBar" });
    state = watchFormReducer(state, { condition: "below", type: "condition" });
    state = watchFormReducer(state, { threshold: "50000", type: "threshold" });
    state = watchFormReducer(state, { type: "values", values: {} });
    state = watchFormReducer(state, { save: { kind: "saving" }, type: "save" });
    expect(state).toStrictEqual({
      condition: "below",
      interval: "15m",
      menuBar: true,
      save: { kind: "saving" },
      threshold: "50000",
      values: {},
    });
  });

  it("parses thresholds and knows which conditions need one", () => {
    expect([
      parseThreshold("50000"),
      parseThreshold(" "),
      parseThreshold("5k"),
    ]).toStrictEqual([50_000, null, null]);
    expect(
      ["below", "above", "hasRows", "changed", "none"].map((kind) =>
        needsThreshold(kind as "below")
      )
    ).toStrictEqual([true, true, false, false, false]);
  });

  it("builds a draft, or none while a threshold is missing", () => {
    const state = {
      ...initialWatchForm(kpi, null),
      condition: "below" as const,
      menuBar: true,
    };
    expect(draftOfForm(kpi, null, state)).toBeNull();
    expect(
      draftOfForm(kpi, makeWatch(), { ...state, threshold: "50000" })
    ).toStrictEqual({
      alert: { kind: "below", threshold: 50_000 },
      id: "watch-mrr",
      interval: "5m",
      menuBar: true,
      paused: false,
      values: { period: "last7d" },
      widgetId: "w-mrr",
    });
  });

  it("never pins a non-KPI widget and maps row conditions", () => {
    const table = makeWidget();
    const state = {
      ...initialWatchForm(table, null),
      condition: "hasRows" as const,
      menuBar: true,
    };
    expect(draftOfForm(table, null, state)).toMatchObject({
      alert: { kind: "hasRows" },
      menuBar: false,
    });
    expect(
      draftOfForm(table, null, { ...state, condition: "none" })?.alert
    ).toBeNull();
  });
});

describe("watch actions and glyphs", () => {
  it("offers Watch… and, for KPIs, the menu bar", () => {
    expect(watchActions(kpi, null).map((action) => action.label)).toStrictEqual(
      ["Watch…", "Show in Menu Bar"]
    );
    expect(
      watchActions(kpi, makeWatch({ menuBar: true })).map(
        (action) => action.label
      )
    ).toStrictEqual(["Edit Watch…", "Remove from Menu Bar"]);
    expect(watchActions(makeWidget(), null)).toHaveLength(1);
  });

  it("picks the glyph that says the most", () => {
    expect(
      glyphKindOf(makeWatch({ alert: { kind: "changed" }, menuBar: true }))
    ).toBe("menuBar");
    expect(glyphKindOf(makeWatch({ alert: { kind: "changed" } }))).toBe(
      "alert"
    );
    expect(glyphKindOf(makeWatch())).toBe("watch");
  });
});

describe("alertsOf", () => {
  it("lists unseen alerts newest first with plain labels", () => {
    const older = firedAlert({
      alertState: {
        armed: false,
        falseStreak: 0,
        lastFiredAt: localTime(8, 0),
        seenAt: null,
      },
      id: "older",
      widgetId: "w-arr",
    });
    const seen = firedAlert({
      alertState: {
        armed: false,
        falseStreak: 0,
        lastFiredAt: localTime(8, 0),
        seenAt: localTime(8, 30),
      },
      id: "seen",
    });
    const alerts = alertsOf(
      [older, firedAlert(), seen, firedAlert({ id: "gone", widgetId: "x" })],
      [kpi, makeKpiWidget({ id: "w-arr", name: "ARR" })]
    );
    expect(alerts).toStrictEqual([
      {
        firedAt: localTime(9, 41),
        label: "MRR below $50k",
        watchId: "watch-mrr",
        widgetId: "w-mrr",
      },
      {
        firedAt: localTime(8, 0),
        label: "ARR below $50k",
        watchId: "older",
        widgetId: "w-arr",
      },
    ]);
  });
});
