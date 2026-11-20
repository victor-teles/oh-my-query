import { describe, expect, it } from "vitest";

import type { Board, ParamDef } from "@/lib/ipc";

import { makeWidget } from "@/test/widget-fixtures";

import {
  changedKeys,
  filterValues,
  sharedInputs,
  tilesAffectedBy,
  tileValues,
  updatedLabel,
} from "./board-inputs";

const period: ParamDef = {
  default: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
};
const region: ParamDef = {
  default: "Europe",
  label: "Region",
  name: "region",
  options: ["Europe", "Asia"],
  type: "select",
};
const periodText: ParamDef = {
  default: "q3",
  label: "Period",
  name: "period",
  type: "text",
};

const revenue = makeWidget({ id: "w1", params: [region, period] });
const signups = makeWidget({
  id: "w2",
  lastValues: { period: "ytd" },
  params: [period],
});
const notes = makeWidget({ id: "w3", params: [periodText] });
const fixed = makeWidget({ id: "w4", params: [{ ...region, fixed: true }] });

const widgets = new Map([revenue, signups, notes, fixed].map((w) => [w.id, w]));

const board: Board = {
  createdAt: "2026-11-19T00:00:00.000Z",
  id: "b1",
  name: "Ops",
  refresh: "off",
  sharedValues: {},
  tiles: [
    { id: "t1", size: "m", widgetId: "w1" },
    { id: "t2", size: "m", widgetId: "w2" },
    { id: "t3", size: "s", widgetId: "w3" },
    { id: "t4", size: "s", widgetId: "w4" },
    { id: "t5", size: "s", widgetId: "missing" },
  ],
  updatedAt: "2026-11-19T00:00:00.000Z",
};

describe("sharedInputs", () => {
  it("unions editable inputs by name and type", () => {
    const inputs = sharedInputs(board, widgets);
    expect(inputs.map((input) => [input.key, input.tileIds])).toStrictEqual([
      ["region:select", ["t1"]],
      ["period:dateRange", ["t1", "t2"]],
      ["period:text", ["t3"]],
    ]);
  });
});

describe("tileValues", () => {
  it("overrides only inputs with a matching name and type", () => {
    const shared = { "period:dateRange": "last30d", "region:text": "Nope" };
    expect(tileValues(signups, shared)).toStrictEqual({ period: "last30d" });
    expect(tileValues(revenue, shared)).toStrictEqual({
      period: "last30d",
      region: "Europe",
    });
    expect(tileValues(notes, shared)).toStrictEqual({ period: "q3" });
  });
});

describe("filterValues", () => {
  it("shows the board value, else the first widget's own value", () => {
    const inputs = sharedInputs(board, widgets);
    expect(
      filterValues(inputs, { "region:select": "Asia" }, widgets)
    ).toStrictEqual({
      "period:dateRange": "lastQuarter",
      "period:text": "q3",
      "region:select": "Asia",
    });
  });
});

describe("change tracking", () => {
  it("finds changed keys and the tiles they affect", () => {
    const inputs = sharedInputs(board, widgets);
    const keys = changedKeys(
      { "period:dateRange": "ytd", "region:select": "Europe" },
      {
        "period:dateRange": { from: "2026-01-01", to: "2026-02-01" },
        "region:select": "Europe",
      }
    );
    expect(keys).toStrictEqual(["period:dateRange"]);
    expect(tilesAffectedBy(inputs, keys)).toStrictEqual(["t1", "t2"]);
  });
});

describe("updatedLabel", () => {
  it("reads relative time", () => {
    const now = 10_000_000;
    expect(updatedLabel(null, now)).toBe("Not updated yet");
    expect(updatedLabel(now - 5000, now)).toBe("Updated just now");
    expect(updatedLabel(now - 125_000, now)).toBe("Updated 2m ago");
    expect(updatedLabel(now - 2 * 3_600_000, now)).toBe("Updated 2h ago");
  });
});
