import { describe, expect, it } from "vitest";

import type { MeasureText } from "./chart-image-layout";

import { chartImageLayout, truncateToWidth } from "./chart-image-layout";

const CHAR_WIDTH = 10;
const measure: MeasureText = (text) => [...text].length * CHAR_WIDTH;

const chart = { height: 200, width: 400 };

describe("chartImageLayout", () => {
  it("stacks title, subtitle, legend and chart inside 24px padding", () => {
    const layout = chartImageLayout({
      chart,
      legend: [{ color: "red", label: "EMEA" }],
      measure,
      subtitle: "Last 12 months",
      title: "Revenue",
    });
    expect(layout).toMatchObject({
      chart: { height: 200, width: 400, x: 24, y: 102 },
      height: 326,
      legend: [{ labelX: 38, swatch: { size: 8, x: 24, y: 78 } }],
      subtitle: { text: "Last 12 months", x: 24, y: 54 },
      title: { text: "Revenue", x: 24, y: 34 },
      width: 448,
    });
  });

  it("skips the subtitle and legend space when they are absent", () => {
    const layout = chartImageLayout({
      chart,
      legend: [],
      measure,
      title: "KPI",
    });
    expect(layout.subtitle).toBeNull();
    expect(layout.chart.y).toBe(56);
    expect(layout.height).toBe(280);
  });

  it("wraps legend entries onto new rows when the width runs out", () => {
    const legend = [
      "North America",
      "Europe",
      "Asia Pacific",
      "Latin America",
    ].map((label) => ({ color: "red", label }));
    const layout = chartImageLayout({
      chart,
      legend,
      measure,
      title: "Revenue",
    });
    const rows = [...new Set(layout.legend.map((entry) => entry.baseline))];
    expect(rows).toHaveLength(2);
    expect(layout.legend[3]?.swatch.x).toBe(24);
  });

  it("truncates a long title with an ellipsis", () => {
    const layout = chartImageLayout({
      chart: { height: 100, width: 100 },
      legend: [],
      measure,
      title: "Monthly recurring revenue",
    });
    expect(layout.title.text).toBe("Monthly r…");
    expect(measure(layout.title.text, "")).toBeLessThanOrEqual(100);
  });
});

describe("truncateToWidth", () => {
  it("keeps text that fits", () => {
    expect(truncateToWidth("abc", 30, "", measure)).toBe("abc");
  });

  it("returns only an ellipsis when nothing fits", () => {
    expect(truncateToWidth("abc", 5, "", measure)).toBe("…");
  });
});
