import { describe, expect, it } from "vitest";

import { CARD_SPEC_VERSION, CardSpec } from "./card-spec.ts";

const base = {
  title: "Monthly recurring revenue by region",
  version: CARD_SPEC_VERSION,
};

describe("cardSpec", () => {
  it("parses a chart view and applies defaults", () => {
    const spec = CardSpec.parse({
      ...base,
      view: { kind: "chart", mark: "line", x: "month", y: ["mrr"] },
    });
    expect(spec.view).toStrictEqual({
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    });
    expect(spec.formats).toStrictEqual({});
  });

  it("parses a grouped chart with formats, subtitle and insight", () => {
    const spec = CardSpec.parse({
      ...base,
      formats: { mrr: { currency: "USD", kind: "currency" } },
      insight: "Asia Pacific more than doubled this year.",
      subtitle: "Jan to Sep 2026",
      view: {
        groupBy: "region",
        kind: "chart",
        mark: "area",
        stacked: true,
        x: "month",
        y: ["mrr"],
      },
    });
    expect(spec.formats.mrr).toStrictEqual({
      currency: "USD",
      kind: "currency",
    });
    expect(spec.view.kind).toBe("chart");
  });

  it("parses pie, kpi and table views", () => {
    const views = [
      { kind: "pie", label: "plan", value: "accounts" },
      { delta: "change_pct", kind: "kpi", label: "MRR", value: "mrr" },
      { kind: "table" },
      { columns: ["a", "b"], kind: "table" },
    ];
    for (const view of views) {
      expect(CardSpec.safeParse({ ...base, view }).success).toBeTruthy();
    }
  });

  it("rejects groupBy with more than one y column", () => {
    const result = CardSpec.safeParse({
      ...base,
      view: {
        groupBy: "region",
        kind: "chart",
        mark: "bar",
        x: "month",
        y: ["mrr", "arr"],
      },
    });
    expect(result.success).toBeFalsy();
  });

  it("rejects a title over 80 characters", () => {
    const result = CardSpec.safeParse({
      ...base,
      title: "x".repeat(81),
      view: { kind: "table" },
    });
    expect(result.success).toBeFalsy();
  });

  it("rejects more than six y columns and an unknown version", () => {
    const tooMany = CardSpec.safeParse({
      ...base,
      view: {
        kind: "chart",
        mark: "bar",
        x: "month",
        y: ["a", "b", "c", "d", "e", "f", "g"],
      },
    });
    const wrongVersion = CardSpec.safeParse({
      ...base,
      version: 3,
      view: { kind: "table" },
    });
    expect(tooMany.success).toBeFalsy();
    expect(wrongVersion.success).toBeFalsy();
  });

  it("upgrades a version 1 spec to the current version", () => {
    const spec = CardSpec.parse({
      formats: {},
      title: "Revenue",
      version: 1,
      view: { kind: "table" },
    });
    expect(CARD_SPEC_VERSION).toBe(2);
    expect(spec.version).toBe(CARD_SPEC_VERSION);
  });

  it("rejects a currency code that is not three letters", () => {
    const result = CardSpec.safeParse({
      ...base,
      formats: { mrr: { currency: "US", kind: "currency" } },
      view: { kind: "table" },
    });
    expect(result.success).toBeFalsy();
  });
});
