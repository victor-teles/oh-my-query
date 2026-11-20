import type { ColumnInfo } from "@oh-my-query/core/client";

import { describe, expect, it } from "vitest";

import type { CardResult } from "./card-format.ts";
import type { CardSpec } from "./card-spec.ts";

import {
  columnValues,
  formatContextFor,
  formatFor,
  formatScalar,
  formatScalarValue,
  formatTick,
  formatValue,
  isIsoDate,
  scalarOf,
  toNumber,
} from "./card-format.ts";

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

const specOf = (
  view: CardSpec["view"],
  formats: CardSpec["formats"] = {}
): CardSpec => ({ formats, title: "t", version: 1, view });

describe("formatValue and formatTick", () => {
  it("formats currency compactly from 10k, and always compactly on ticks", () => {
    const usd = { currency: "USD", kind: "currency" } as const;
    expect(formatValue(258_000, usd)).toBe("$258k");
    expect(formatValue("1200000", usd)).toBe("$1.2M");
    expect(formatValue(4500.5, usd)).toBe("$4,500.5");
    expect(formatValue(-12_500, usd)).toBe("-$12.5k");
    expect(formatTick(300_000, usd)).toBe("$300k");
  });

  it("formats months and dates in UTC", () => {
    expect(formatTick("2026-01-01", { kind: "month" })).toBe("Jan");
    expect(formatValue("2026-01-01T00:00:00.000Z", { kind: "month" })).toBe(
      "Jan 2026"
    );
    expect(formatTick("2026-08-03", { kind: "date" })).toBe("Aug 3");
    expect(formatValue("2026-08-03", { kind: "date" })).toBe("Aug 3, 2026");
  });

  it("scales percentages written as fractions", () => {
    const context = formatContextFor([0.125, 0.5]);
    expect(formatValue(0.125, { kind: "percent" }, context)).toBe("12.5%");
    expect(
      formatValue(12.5, { kind: "percent" }, formatContextFor([12.5, 40]))
    ).toBe("12.5%");
  });

  it("formats plain, integer and compact numbers, nulls and text", () => {
    expect(formatValue(1234.567)).toBe("1,234.57");
    expect(formatValue("41.6", { kind: "integer" })).toBe("42");
    expect(formatValue(18_226, { kind: "compact" })).toBe("18.2k");
  });

  it("formats negative ticks, nulls and text", () => {
    expect(formatTick(-2500)).toBe("-2.5k");
    expect(formatValue(null)).toBe("—");
    expect(formatValue("paid")).toBe("paid");
  });
});

describe("formatFor", () => {
  it("prefers the declared format and otherwise infers month or date", () => {
    const spec = { formats: { mrr: { kind: "currency" as const } } };
    expect(formatFor(spec, "mrr", ["1"])).toStrictEqual({ kind: "currency" });
    expect(formatFor(spec, "month", MONTHS)).toStrictEqual({ kind: "month" });
    expect(formatFor(spec, "day", ["2026-08-03"])).toStrictEqual({
      kind: "date",
    });
    expect(formatFor(spec, "region", ["Europe"])).toBeUndefined();
  });
});

describe("value helpers", () => {
  it("reads finite numbers from numbers and numeric strings only", () => {
    expect(toNumber(4)).toBe(4);
    expect(toNumber(" 12.5 ")).toBe(12.5);
    expect(
      ["", "abc", Number.POSITIVE_INFINITY, null].map(toNumber)
    ).toStrictEqual([null, null, null, null]);
  });

  it("reads a column by name and returns nothing for an unknown one", () => {
    const result = resultOf([col("a"), col("b")], [[1, 2]]);
    expect(columnValues(result, "b")).toStrictEqual([2]);
    expect(columnValues(result, "c")).toStrictEqual([]);
  });

  it("recognizes ISO dates", () => {
    expect(isIsoDate("2026-08-03")).toBeTruthy();
    expect(isIsoDate("2026-08-03T10:00:00Z")).toBeTruthy();
    expect(isIsoDate("Aug 3")).toBeFalsy();
    expect(isIsoDate(20_260_803)).toBeFalsy();
  });
});

describe("scalarOf", () => {
  const kpi = specOf({ kind: "kpi", value: "mrr" });

  it("reads a KPI's value column from the first row, numeric strings included", () => {
    const result = resultOf(
      [col("region"), col("mrr", "NUMERIC")],
      [
        ["Europe", "48200"],
        ["Asia", "100"],
      ]
    );
    expect(scalarOf(kpi, result)).toStrictEqual({
      column: "mrr",
      value: 48_200,
    });
  });

  it("reads the single cell of a one-by-one result for other views", () => {
    const result = resultOf([col("count", "BIGINT")], [[12]]);
    expect(scalarOf(specOf({ kind: "table" }), result)).toStrictEqual({
      column: "count",
      value: 12,
    });
  });

  it("has no scalar for multi-row non-KPI results, nulls or text", () => {
    const rows = resultOf([col("count")], [[1], [2]]);
    expect(scalarOf(specOf({ kind: "table" }), rows)).toBeNull();
    expect(scalarOf(kpi, resultOf([col("mrr")], [[null]]))).toBeNull();
    expect(scalarOf(kpi, resultOf([col("mrr")], [["n/a"]]))).toBeNull();
    expect(scalarOf(kpi, resultOf([col("mrr")], [[true]]))).toBeNull();
    expect(scalarOf(kpi, resultOf([col("mrr")], []))).toBeNull();
  });
});

describe("formatScalar", () => {
  it("formats currency and percent compactly through the spec's formats", () => {
    const usd = specOf(
      { kind: "kpi", value: "mrr" },
      { mrr: { currency: "USD", kind: "currency" } }
    );
    expect(formatScalar(usd, resultOf([col("mrr")], [[12_400]]))).toBe(
      "$12.4k"
    );
    const percent = specOf(
      { kind: "kpi", value: "rate" },
      { rate: { kind: "percent" } }
    );
    expect(formatScalar(percent, resultOf([col("rate")], [[0.125]]))).toBe(
      "13%"
    );
  });

  it("formats a bare value and returns null without a scalar", () => {
    const table = specOf({ kind: "table" });
    expect(formatScalar(table, resultOf([col("n")], [[2500]]))).toBe("2.5k");
    expect(formatScalar(table, resultOf([col("n")], []))).toBeNull();
    expect(formatScalarValue(table, 18)).toBe("18");
  });
});
