import type { CardResult } from "@oh-my-query/rpc";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import type { CardSpec, ChartView } from "@/lib/ipc";

import { REVENUE_BY_REGION } from "@/lib/browser-ask-recordings";
import { chartModelOf, OTHER_LABEL, X_KEY } from "@/lib/card-data";

import {
  drillPrompt,
  drillSegments,
  isRedacted,
  MAX_DRILL_SEGMENTS,
  segmentLabel,
  segmentOfBar,
  segmentOfRow,
  segmentOfSlice,
} from "./drill";

const result: CardResult = {
  columns: REVENUE_BY_REGION.columns,
  isTruncated: false,
  rowCount: REVENUE_BY_REGION.rows.length,
  rows: REVENUE_BY_REGION.rows,
};
const { spec } = REVENUE_BY_REGION;
const chartView: ChartView = {
  groupBy: "region",
  kind: "chart",
  mark: "line",
  stacked: false,
  x: "month",
  y: ["mrr"],
};
const model = chartModelOf(chartView, result, spec.formats);

const tableResult: CardResult = {
  columns: [
    { name: "id", typeName: "INT8" },
    { name: "email", typeName: "TEXT" },
    { name: "status", typeName: "TEXT" },
    { name: "plan", typeName: "TEXT" },
  ],
  isTruncated: false,
  rowCount: 2,
  rows: [
    [1, "ada@example.com", "paid", "pro"],
    [2, null, "", "free"],
  ],
};

const JANUARY = { [X_KEY]: "2026-01-01" };

describe("segmentOfBar", () => {
  it("filters by the series group and the x value", () => {
    expect(model.data.series[1]?.label).toBe("Europe");
    expect(segmentOfBar(chartView, model, JANUARY, "s1")).toStrictEqual({
      filters: [
        { column: "region", value: "Europe" },
        { column: "month", value: "2026-01-01" },
      ],
    });
  });

  it("filters by x alone for a point without a series", () => {
    expect(segmentOfBar(chartView, model, JANUARY, null)).toStrictEqual({
      filters: [{ column: "month", value: "2026-01-01" }],
    });
  });

  it.each([
    ["an empty x", { [X_KEY]: null }],
    ["a blank x", { [X_KEY]: "  " }],
  ])("is not drillable for %s", (_label, row) => {
    expect(segmentOfBar(chartView, model, row, null)).toBeNull();
  });

  it("is not drillable for the Other series", () => {
    const other = {
      ...model,
      data: {
        ...model.data,
        series: [{ color: "red", key: "s9", label: OTHER_LABEL }],
      },
    };
    expect(
      segmentOfBar(chartView, other, { [X_KEY]: "2026-01-01" }, "s9")
    ).toBeNull();
  });
});

describe("segmentOfSlice and segmentOfRow", () => {
  const pie = { kind: "pie" as const, label: "status", value: "n" };

  it("filters a slice by its label", () => {
    expect(segmentOfSlice(pie, "paid")).toStrictEqual({
      filters: [{ column: "status", value: "paid" }],
    });
  });

  it.each([OTHER_LABEL, "—", ""])("skips the %j slice", (label) => {
    expect(segmentOfSlice(pie, label)).toBeNull();
  });

  it("uses up to two non-numeric cells of a row", () => {
    expect(segmentOfRow(tableResult, 0)).toStrictEqual({
      filters: [
        { column: "email", value: "ada@example.com" },
        { column: "status", value: "paid" },
      ],
    });
  });

  it("skips empty cells and respects the visible columns", () => {
    expect(segmentOfRow(tableResult, 1)).toStrictEqual({
      filters: [{ column: "plan", value: "free" }],
    });
    expect(segmentOfRow(tableResult, 0, ["id", "plan"])).toStrictEqual({
      filters: [{ column: "plan", value: "pro" }],
    });
    expect(segmentOfRow(tableResult, 9)).toBeNull();
  });
});

describe("drillPrompt and labels", () => {
  const segment = {
    filters: [
      { column: "region", value: "Europe" },
      { column: "month", value: "2026-03-01" },
    ],
  };

  it("formats values with the card's formats", () => {
    expect(drillPrompt(segment, spec.formats)).toBe(
      'break down region "Europe", month "Mar 2026"'
    );
    expect(segmentLabel(segment, spec.formats)).toBe("Europe · Mar 2026");
  });

  it("flags values PII redaction would hide", () => {
    expect(
      isRedacted(
        { filters: [{ column: "email", value: "ada@example.com" }] },
        []
      )
    ).toBeTruthy();
    expect(isRedacted(segment, [])).toBeFalsy();
    expect(isRedacted(segment, ["Europe"])).toBeTruthy();
  });
});

describe("drillSegments", () => {
  it("offers each region per month for a grouped chart", () => {
    const segments = drillSegments(spec, result, "line");
    expect(segments).toHaveLength(27);
    expect(segments[0]).toStrictEqual({
      filters: [
        { column: "region", value: "North America" },
        { column: "month", value: "2026-01-01" },
      ],
    });
  });

  it("offers rows for a table and nothing for a KPI", () => {
    const tableSpec: CardSpec = { ...spec, view: { kind: "table" } };
    expect(drillSegments(tableSpec, tableResult, "table")).toHaveLength(2);
    const kpi: CardSpec = { ...spec, view: { kind: "kpi", value: "id" } };
    expect(drillSegments(kpi, tableResult, "kpi")).toStrictEqual([]);
  });

  it("offers each slice of a pie", () => {
    const pieSpec: CardSpec = {
      formats: {},
      title: "Plans",
      version: CARD_SPEC_VERSION,
      view: { kind: "pie", label: "plan", value: "id" },
    };
    expect(
      drillSegments(pieSpec, tableResult, "pie").map((item) =>
        segmentLabel(item, {})
      )
    ).toStrictEqual(["free", "pro"]);
  });

  it("caps the list and ignores a view the card can't take", () => {
    const rows = Array.from({ length: 80 }, (_, index) => [
      index,
      `user${index}`,
      "paid",
      "pro",
    ]);
    const many = { ...tableResult, rowCount: rows.length, rows };
    const tableSpec: CardSpec = { ...spec, view: { kind: "table" } };
    expect(drillSegments(tableSpec, many, "table")).toHaveLength(
      MAX_DRILL_SEGMENTS
    );
    expect(drillSegments(tableSpec, many, "pie")).toStrictEqual([]);
  });
});
