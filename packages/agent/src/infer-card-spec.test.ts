import type { ColumnInfo } from "@oh-my-query/core";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import { checkCardAgainstResult } from "./check-card-spec.ts";
import { computeColumnStats } from "./column-stats.ts";
import { inferCardSpec, titleFor } from "./infer-card-spec.ts";

const col = (name: string, typeName = "TEXT"): ColumnInfo => ({
  name,
  typeName,
});

const context = { prompt: "revenue by region", sql: "select 1" };

const MONTHS = ["2026-01-01", "2026-02-01", "2026-03-01"];

describe("inferCardSpec", () => {
  it("shows a single numeric value as a KPI", () => {
    const spec = inferCardSpec(
      { columns: [col("total_mrr", "NUMERIC")], rows: [["475000.00"]] },
      context
    );
    expect(spec.view).toStrictEqual({ kind: "kpi", value: "total_mrr" });
    expect(spec.formats.total_mrr).toStrictEqual({
      currency: "USD",
      kind: "currency",
    });
  });

  it("draws a temporal first column as a line with month formatting", () => {
    const spec = inferCardSpec(
      {
        columns: [col("month", "DATE"), col("signups", "INT8")],
        rows: MONTHS.map((month, i) => [month, String(10 + i)]),
      },
      context
    );
    expect(spec.view).toStrictEqual({
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["signups"],
    });
    expect(spec.formats.month).toStrictEqual({ kind: "month" });
  });

  it("pivots a low-cardinality text column with groupBy", () => {
    const regions = ["North America", "Europe", "Asia Pacific"];
    const rows = MONTHS.flatMap((month) =>
      regions.map((region, i) => [month, region, 1000 * (i + 1)])
    );
    const spec = inferCardSpec(
      {
        columns: [
          col("month", "TIMESTAMPTZ"),
          col("region"),
          col("mrr", "NUMERIC"),
        ],
        rows,
      },
      context
    );
    expect(spec.view).toStrictEqual({
      groupBy: "region",
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    });
  });

  it("falls back to a table when a category has too many values", () => {
    const rows = Array.from({ length: 8 }, (_, i) => [
      MONTHS[0],
      `customer-${i}`,
      i,
    ]);
    const spec = inferCardSpec(
      {
        columns: [col("month", "DATE"), col("customer"), col("orders", "INT4")],
        rows,
      },
      context
    );
    expect(spec.view).toStrictEqual({ kind: "table" });
  });

  it("draws a categorical first column as a bar", () => {
    const spec = inferCardSpec(
      {
        columns: [
          col("plan"),
          col("accounts", "INT8"),
          col("churn_rate", "FLOAT8"),
        ],
        rows: [
          ["free", 120, 0.08],
          ["pro", 40, 0.02],
        ],
      },
      context
    );
    expect(spec.view).toStrictEqual({
      kind: "chart",
      mark: "bar",
      stacked: false,
      x: "plan",
      y: ["accounts", "churn_rate"],
    });
    expect(spec.formats.churn_rate).toStrictEqual({ kind: "percent" });
  });

  it("treats an ascending numeric year as an ordered axis", () => {
    const spec = inferCardSpec(
      {
        columns: [col("year", "INT4"), col("orders", "INT4")],
        rows: [
          [2024, 10],
          [2025, 14],
        ],
      },
      context
    );
    expect(spec.view).toMatchObject({ mark: "line", x: "year" });
  });

  it("falls back to a table for non-numeric results and empty results", () => {
    const text = inferCardSpec(
      {
        columns: [col("email"), col("name")],
        rows: [
          ["a@x.io", "A"],
          ["b@x.io", "B"],
        ],
      },
      context
    );
    const empty = inferCardSpec(
      { columns: [col("n", "INT4")], rows: [] },
      context
    );
    expect(text.view).toStrictEqual({ kind: "table" });
    expect(empty.view).toStrictEqual({ kind: "table" });
  });

  it("formats dates that are not month starts as dates and leaves plain numbers alone", () => {
    const spec = inferCardSpec(
      {
        columns: [col("day", "DATE"), col("orders", "INT4")],
        rows: [
          ["2026-08-03", 4],
          ["2026-08-04", 6],
        ],
      },
      context
    );
    expect(spec.formats).toStrictEqual({ day: { kind: "date" } });
  });
});

describe("minor units", () => {
  it("never formats a _cents column as currency", () => {
    const spec = inferCardSpec(
      {
        columns: [col("status"), col("revenue_cents", "INT8")],
        rows: [
          ["paid", "13999"],
          ["refunded", "799"],
        ],
      },
      context
    );
    expect(spec.formats.revenue_cents).toBeUndefined();
  });
});

describe("titleFor", () => {
  it("uses the SQL leading comment", () => {
    expect(
      titleFor("-- Monthly recurring revenue by region\nselect 1", "mrr")
    ).toBe("Monthly recurring revenue by region");
  });

  it("falls back to the prompt and clips long titles", () => {
    expect(titleFor("select 1", "revenue by region")).toBe("Revenue by region");
    const long = titleFor("select 1", "x".repeat(100));
    expect(long).toHaveLength(80);
    expect(long.endsWith("…")).toBeTruthy();
  });
});

describe("checkCardAgainstResult", () => {
  const data = {
    columns: [col("month", "DATE"), col("region"), col("mrr", "NUMERIC")],
    rows: MONTHS.map((month) => [month, "EU", "10"]),
  };
  const stats = computeColumnStats(data);
  const base = { formats: {}, title: "t", version: CARD_SPEC_VERSION };

  it("accepts a spec that references real numeric columns", () => {
    const spec = {
      ...base,
      view: {
        kind: "chart" as const,
        mark: "line" as const,
        stacked: false,
        x: "month",
        y: ["mrr"],
      },
    };
    expect(checkCardAgainstResult(spec, stats, 3)).toBeNull();
  });

  it("rejects unknown columns, including in formats", () => {
    const view = { kind: "kpi" as const, value: "arr" };
    expect(checkCardAgainstResult({ ...base, view }, stats, 3)).toContain(
      "arr"
    );
    expect(
      checkCardAgainstResult(
        {
          ...base,
          formats: { nope: { kind: "text" } },
          view: { kind: "table" },
        },
        stats,
        3
      )
    ).toContain("nope");
  });

  it("rejects a non-numeric y and an oversized pie", () => {
    const chart = {
      kind: "chart" as const,
      mark: "bar" as const,
      stacked: false,
      x: "month",
      y: ["region"],
    };
    const pie = { kind: "pie" as const, label: "region", value: "mrr" };
    expect(
      checkCardAgainstResult({ ...base, view: chart }, stats, 3)
    ).toContain("not numeric");
    expect(checkCardAgainstResult({ ...base, view: pie }, stats, 9)).toContain(
      "pie"
    );
  });

  it("rejects a pie that labels slices with its own value column", () => {
    const pie = { kind: "pie" as const, label: "mrr", value: "mrr" };
    expect(checkCardAgainstResult({ ...base, view: pie }, stats, 3)).toBe(
      "A pie chart needs separate label and value columns."
    );
  });

  it("rejects a single-slice pie and a KPI over several rows", () => {
    const pie = { kind: "pie" as const, label: "region", value: "mrr" };
    const kpi = { kind: "kpi" as const, value: "mrr" };
    expect(checkCardAgainstResult({ ...base, view: pie }, stats, 1)).toContain(
      "2 to 8 slices"
    );
    expect(checkCardAgainstResult({ ...base, view: kpi }, stats, 3)).toBe(
      "A KPI shows a single row."
    );
  });

  it("rejects a chart that plots its x column as a series", () => {
    const chart = {
      kind: "chart" as const,
      mark: "bar" as const,
      stacked: false,
      x: "mrr",
      y: ["mrr"],
    };
    expect(checkCardAgainstResult({ ...base, view: chart }, stats, 3)).toBe(
      "A chart cannot plot its x column as a series."
    );
  });
});
