import type { CardResult } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it } from "vitest";

import type { CardSpec, ChartView, ColumnInfo } from "./ipc";

import {
  alternatesFor,
  chartModelOf,
  humanize,
  inferView,
  latestValues,
  OTHER_LABEL,
  pivotLongToWide,
  seriesOf,
  slicesOf,
  trendOf,
  viewKindOf,
  X_KEY,
} from "./card-data";

const col = (name: string, typeName = "TEXT"): ColumnInfo => ({
  name,
  typeName,
});

const resultOf = (columns: ColumnInfo[], rows: unknown[][]): CardResult => ({
  columns,
  isTruncated: false,
  rowCount: rows.length,
  rows,
});

const MONTHS = ["2026-01-01", "2026-02-01", "2026-03-01"];

const mrr = resultOf(
  [col("month", "DATE"), col("region"), col("mrr", "NUMERIC")],
  MONTHS.flatMap((month, m) => [
    [month, "North America", String(100 + m * 10)],
    [month, "Europe", String(60 + m * 5)],
    [month, "Asia Pacific", m === 1 ? null : String(30 + m * 20)],
  ])
);

const mrrView: ChartView = {
  groupBy: "region",
  kind: "chart",
  mark: "line",
  stacked: false,
  x: "month",
  y: ["mrr"],
};

const specOf = (view: CardSpec["view"]): CardSpec => ({
  formats: {},
  title: "t",
  version: CARD_SPEC_VERSION,
  view,
});

describe("pivotLongToWide", () => {
  it("turns one row per group into one row per x with a column per group", () => {
    const pivot = pivotLongToWide(mrr, "month", "mrr", "region");
    expect(pivot.groups).toStrictEqual([
      "North America",
      "Europe",
      "Asia Pacific",
    ]);
    expect(pivot.rows[0]).toStrictEqual({
      "Asia Pacific": 30,
      Europe: 60,
      "North America": 100,
      [X_KEY]: "2026-01-01",
    });
  });

  it("leaves a null amount out instead of writing zero", () => {
    const pivot = pivotLongToWide(mrr, "month", "mrr", "region");
    expect(pivot.rows[1]).not.toHaveProperty("Asia Pacific");
  });

  it("keeps the top five groups and folds the rest into Other", () => {
    const rows = Array.from({ length: 8 }, (_, i) => [
      "2026-01-01",
      `g${i}`,
      i + 1,
    ]);
    const pivot = pivotLongToWide(
      resultOf([col("day", "DATE"), col("group"), col("n", "INT4")], rows),
      "day",
      "n",
      "group"
    );
    expect(pivot.groups).toStrictEqual([
      "g7",
      "g6",
      "g5",
      "g4",
      "g3",
      OTHER_LABEL,
    ]);
    expect(pivot.rows[0]?.[OTHER_LABEL]).toBe(1 + 2 + 3);
  });
});

describe("seriesOf", () => {
  it("names grouped series after their group and colors them in order", () => {
    const data = seriesOf(mrrView, mrr);
    expect(data.series).toStrictEqual([
      { color: "var(--chart-1)", key: "s0", label: "North America" },
      { color: "var(--chart-2)", key: "s1", label: "Europe" },
      { color: "var(--chart-3)", key: "s2", label: "Asia Pacific" },
    ]);
    expect(data.rows[2]).toStrictEqual({
      s0: 120,
      s1: 70,
      s2: 70,
      x: "2026-03-01",
    });
  });

  it("uses each y column as a series when there is no groupBy", () => {
    const result = resultOf(
      [col("plan"), col("accounts", "INT8"), col("churn_rate", "FLOAT8")],
      [
        ["free", "120", -0.5],
        ["pro", "40", 0.02],
      ]
    );
    const data = seriesOf(
      {
        kind: "chart",
        mark: "bar",
        stacked: false,
        x: "plan",
        y: ["accounts", "churn_rate"],
      },
      result
    );
    expect(data.series.map((series) => series.label)).toStrictEqual([
      "Accounts",
      "Churn rate",
    ]);
    expect(data.rows).toStrictEqual([
      { s0: 120, s1: -0.5, x: "free" },
      { s0: 40, s1: 0.02, x: "pro" },
    ]);
  });
});

describe("slicesOf", () => {
  it("makes one series per slice and folds the tail into Other", () => {
    const rows = Array.from({ length: 8 }, (_, i) => [`p${i}`, i + 1]);
    const data = slicesOf(
      { kind: "pie", label: "plan", value: "n" },
      resultOf([col("plan"), col("n", "INT4")], rows)
    );
    expect(data.series.map((series) => series.label)).toStrictEqual([
      "p7",
      "p6",
      "p5",
      "p4",
      "p3",
      OTHER_LABEL,
    ]);
    expect(data.rows[0]?.s5).toBe(1 + 2 + 3);
    expect(data.rows[0]?.s0).toBe(8);
  });
});

describe("latestValues and trendOf", () => {
  it("takes the last non-null value of each series in x order", () => {
    const latest = latestValues(seriesOf(mrrView, mrr));
    expect(Object.fromEntries(latest)).toStrictEqual({
      s0: 120,
      s1: 70,
      s2: 70,
    });
  });

  it("reports null for a series with no values, and the trend of the first series", () => {
    const data = {
      rows: [{ s0: null, x: "a" }],
      series: [{ color: "", key: "s0", label: "A" }],
    };
    expect(latestValues(data).get("s0")).toBeNull();
    expect(trendOf(data)).toBe("flat");
    expect(trendOf(seriesOf(mrrView, mrr))).toBe("up");
  });

  it("sees a falling first series as down", () => {
    const data = {
      rows: [
        { s0: 5, x: "a" },
        { s0: -3, x: "b" },
      ],
      series: [{ color: "", key: "s0", label: "A" }],
    };
    expect(trendOf(data)).toBe("down");
  });
});

describe("chartModelOf", () => {
  it("bundles the series with the x and y formats and the percent scale", () => {
    const model = chartModelOf(mrrView, mrr, {
      mrr: { currency: "USD", kind: "currency" },
    });
    expect(model.xFormat).toStrictEqual({ kind: "month" });
    expect(model.yFormat).toStrictEqual({ currency: "USD", kind: "currency" });
    expect(model.context).toStrictEqual({ percentScale: 1 });
    expect(model.data.series).toHaveLength(3);
  });

  it("shows latest values only along an ordered axis", () => {
    const categorical = resultOf(
      [col("status"), col("revenue", "NUMERIC")],
      [
        ["paid", "139.99"],
        ["refunded", "7.99"],
      ]
    );
    const bar = chartModelOf(
      {
        kind: "chart",
        mark: "bar",
        stacked: false,
        x: "status",
        y: ["revenue"],
      },
      categorical,
      {}
    );
    expect(chartModelOf(mrrView, mrr, {}).showsLatest).toBeTruthy();
    expect(bar.showsLatest).toBeFalsy();
  });
});

describe("alternatesFor", () => {
  const kinds = (spec: CardSpec, result: CardResult) =>
    alternatesFor(spec, result).map((option) => option.kind);

  it("offers bar, line and table for a temporal chart", () => {
    expect(kinds(specOf(mrrView), mrr)).toStrictEqual(["bar", "line", "table"]);
  });

  it("offers bar and table for a categorical chart, keeping the spec's own mark", () => {
    const result = resultOf(
      [col("plan"), col("n", "INT4")],
      [
        ["a", 1],
        ["b", 2],
      ]
    );
    const bar = specOf({
      kind: "chart",
      mark: "bar",
      stacked: false,
      x: "plan",
      y: ["n"],
    });
    const line = specOf({
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "plan",
      y: ["n"],
    });
    expect(kinds(bar, result)).toStrictEqual(["bar", "table"]);
    expect(kinds(line, result)).toStrictEqual(["bar", "line", "table"]);
  });

  it("offers pie, bar and table for a pie, with the bar built from the pie columns", () => {
    const result = resultOf(
      [col("plan"), col("n", "INT4")],
      [
        ["a", 1],
        ["b", 2],
      ]
    );
    const options = alternatesFor(
      specOf({ kind: "pie", label: "plan", value: "n" }),
      result
    );
    expect(options.map((item) => item.kind)).toStrictEqual([
      "pie",
      "bar",
      "table",
    ]);
    expect(options[1]?.view).toMatchObject({
      mark: "bar",
      x: "plan",
      y: ["n"],
    });
  });

  it("offers KPI and table for a KPI", () => {
    const result = resultOf([col("n", "INT8")], [["3"]]);
    expect(kinds(specOf({ kind: "kpi", value: "n" }), result)).toStrictEqual([
      "kpi",
      "table",
    ]);
  });

  it("offers the charts the data supports for a table", () => {
    expect(kinds(specOf({ kind: "table" }), mrr)).toStrictEqual([
      "table",
      "bar",
      "line",
    ]);
    const single = resultOf([col("n", "INT8")], [["3"]]);
    expect(kinds(specOf({ kind: "table" }), single)).toStrictEqual([
      "table",
      "kpi",
    ]);
    const text = resultOf(
      [col("email"), col("name")],
      [
        ["a", "b"],
        ["c", "d"],
      ]
    );
    expect(kinds(specOf({ kind: "table" }), text)).toStrictEqual(["table"]);
  });
});

describe("inferView", () => {
  it("groups a temporal series by a low-cardinality category", () => {
    expect(inferView(mrr)).toStrictEqual(mrrView);
  });

  it("treats an ascending year as ordered and falls back to a table for one row of text", () => {
    const years = resultOf(
      [col("year", "INT4"), col("n", "INT4")],
      [
        [2024, 1],
        [2025, 2],
      ]
    );
    expect(inferView(years)).toMatchObject({ mark: "line", x: "year" });
    expect(inferView(resultOf([col("a")], [["x"]]))).toStrictEqual({
      kind: "table",
    });
  });
});

describe("helpers", () => {
  it("humanizes column names and names view kinds", () => {
    expect(humanize("total_spent_cents")).toBe("Total spent cents");
    expect(viewKindOf(mrrView)).toBe("line");
    expect(viewKindOf({ kind: "table" })).toBe("table");
  });
});
