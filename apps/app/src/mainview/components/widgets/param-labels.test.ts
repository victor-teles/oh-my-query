import { describe, expect, it } from "vitest";

import type { ParamDef } from "@/lib/ipc";

import { makeWidget } from "@/test/widget-fixtures";

import {
  currentValues,
  dayAfter,
  dayBefore,
  formatParamValue,
  formatRange,
  valuesSummary,
} from "./param-labels";

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
  options: ["Europe", "North America"],
  type: "select",
};

describe("formatParamValue", () => {
  it("labels range presets and shows custom ranges inclusively", () => {
    expect(formatParamValue(period, "ytd")).toBe("Year to date");
    expect(
      formatParamValue(period, { from: "2026-01-01", to: "2026-10-01" })
    ).toBe("Jan 1, 2026 – Sep 30, 2026");
  });

  it("shows a one-day range as a single day", () => {
    expect(formatRange({ from: "2026-03-08", to: "2026-03-09" })).toBe(
      "Mar 8, 2026"
    );
  });

  it("labels date presets and formats dates", () => {
    const day = {
      default: "today",
      label: "Day",
      name: "day",
      type: "date",
    } as const;
    expect(formatParamValue(day, "startOfMonth")).toBe("Start of month");
    expect(formatParamValue(day, "2026-02-28")).toBe("Feb 28, 2026");
  });

  it("formats numbers and passes text through", () => {
    const limit = {
      default: 10,
      label: "Limit",
      name: "limit",
      type: "number",
    } as const;
    expect(formatParamValue(limit, 12_000)).toBe("12,000");
    expect(formatParamValue(region, "Europe")).toBe("Europe");
  });
});

describe("day arithmetic", () => {
  it("crosses month and year boundaries", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });
});

describe("currentValues and valuesSummary", () => {
  it("prefers last values over defaults", () => {
    const widget = makeWidget({ lastValues: { region: "North America" } });
    expect(currentValues(widget)).toStrictEqual({
      period: "lastQuarter",
      region: "North America",
    });
    expect(valuesSummary(widget)).toBe("North America · Last quarter");
  });

  it("leaves fixed inputs out of the summary", () => {
    const widget = makeWidget({ params: [{ ...region, fixed: true }, period] });
    expect(valuesSummary(widget)).toBe("Last quarter");
  });
});
