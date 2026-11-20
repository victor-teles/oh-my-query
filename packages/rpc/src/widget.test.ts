import { describe, expect, it } from "vitest";

import type { ParamDef } from "./widget.ts";

import {
  ParamDef as ParamDefSchema,
  paramValueSchema,
  toTemplateValue,
  Widget,
} from "./widget.ts";

const NOW = new Date(2026, 10, 18, 9, 30);

const region: ParamDef = {
  default: "Europe",
  label: "Region",
  name: "region",
  options: ["Europe", "North America"],
  type: "select",
};

const threshold: ParamDef = {
  default: 10,
  label: "Threshold",
  max: 100,
  min: 0,
  name: "threshold",
  type: "number",
};

const period: ParamDef = {
  default: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
};

describe("paramDef", () => {
  it("accepts each input type", () => {
    for (const def of [region, threshold, period]) {
      expect(ParamDefSchema.safeParse(def).success).toBeTruthy();
    }
  });

  it("rejects a name that isn't a lowercase identifier", () => {
    expect(
      ParamDefSchema.safeParse({ ...region, name: "Region Name" }).success
    ).toBeFalsy();
  });

  it("rejects a number default outside its bounds", () => {
    expect(
      ParamDefSchema.safeParse({ ...threshold, default: 101 }).success
    ).toBeFalsy();
  });

  it("rejects a select default missing from its options", () => {
    expect(
      ParamDefSchema.safeParse({ ...region, default: "Mars" }).success
    ).toBeFalsy();
  });

  it("rejects a backwards custom range", () => {
    expect(
      ParamDefSchema.safeParse({
        ...period,
        default: { from: "2026-02-01", to: "2026-01-01" },
      }).success
    ).toBeFalsy();
  });
});

describe("paramValueSchema", () => {
  it("accepts only listed select options", () => {
    expect(paramValueSchema(region).safeParse("Europe").success).toBeTruthy();
    expect(paramValueSchema(region).safeParse("x'; drop").success).toBeFalsy();
  });

  it("checks select values against options loaded from the database", () => {
    const schema = paramValueSchema(
      { ...region, options: undefined, optionsSql: "select 1" },
      ["Asia Pacific"]
    );
    expect(schema.safeParse("Asia Pacific").success).toBeTruthy();
    expect(schema.safeParse("Europe").success).toBeFalsy();
  });

  it("bounds numbers and refuses non-finite values", () => {
    const schema = paramValueSchema(threshold);
    expect(schema.safeParse(50).success).toBeTruthy();
    expect(schema.safeParse(-1).success).toBeFalsy();
    expect(schema.safeParse(Number.POSITIVE_INFINITY).success).toBeFalsy();
    expect(schema.safeParse("50").success).toBeFalsy();
  });

  it("takes a preset or an ISO calendar date", () => {
    const schema = paramValueSchema({
      default: "today",
      label: "Day",
      name: "day",
      type: "date",
    });
    expect(schema.safeParse("startOfMonth").success).toBeTruthy();
    expect(schema.safeParse("2026-02-28").success).toBeTruthy();
    expect(schema.safeParse("2026-02-30").success).toBeFalsy();
    expect(schema.safeParse("02/03/2026").success).toBeFalsy();
  });

  it("caps text length", () => {
    const schema = paramValueSchema({
      default: "",
      label: "Search",
      name: "search",
      type: "text",
    });
    expect(schema.safeParse("a".repeat(200)).success).toBeTruthy();
    expect(schema.safeParse("a".repeat(201)).success).toBeFalsy();
  });
});

describe("toTemplateValue", () => {
  it("resolves a range preset against now", () => {
    expect(toTemplateValue(period, "lastQuarter", NOW)).toStrictEqual({
      from: "2026-07-01",
      kind: "dateRange",
      to: "2026-10-01",
    });
  });

  it("keeps a custom range", () => {
    const range = { from: "2026-01-01", to: "2026-02-01" };
    expect(toTemplateValue(period, range, NOW)).toStrictEqual({
      ...range,
      kind: "dateRange",
    });
  });

  it("resolves a date preset", () => {
    expect(
      toTemplateValue(
        { default: "today", label: "Day", name: "day", type: "date" },
        "startOfYear",
        NOW
      )
    ).toStrictEqual({ kind: "date", value: "2026-01-01" });
  });

  it("maps select and number values", () => {
    expect(toTemplateValue(region, "Europe", NOW)).toStrictEqual({
      kind: "text",
      value: "Europe",
    });
    expect(toTemplateValue(threshold, 5, NOW)).toStrictEqual({
      kind: "number",
      value: 5,
    });
  });
});

describe("widget", () => {
  const base = {
    connectionId: "c1",
    createdAt: "2026-11-18T00:00:00.000Z",
    database: null,
    dialect: "postgresql",
    id: "w1",
    lastRunAt: null,
    lastValues: {},
    name: "Revenue by region",
    params: [region, period],
    prompt: "revenue by region",
    spec: {
      formats: {},
      title: "Revenue",
      version: 1,
      view: { kind: "table" },
    },
    sqlTemplate: "select 1",
    updatedAt: "2026-11-18T00:00:00.000Z",
    view: "table",
  };

  it("parses a widget", () => {
    expect(Widget.safeParse(base).success).toBeTruthy();
  });

  it("rejects duplicate input names", () => {
    expect(
      Widget.safeParse({ ...base, params: [region, region] }).success
    ).toBeFalsy();
  });

  it("caps inputs at six", () => {
    const params = Array.from({ length: 7 }, (_, index) => ({
      ...threshold,
      name: `n${index}`,
    }));
    expect(Widget.safeParse({ ...base, params }).success).toBeFalsy();
  });
});
