import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { makeKpiWidget, makeTrend } from "@/test/watch-fixtures";

import { resetDrawnSparklines, sparkPoints } from "./sparkline";
import { clockTime } from "./trend-delta";
import { WidgetTrend } from "./widget-trend";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const { spec } = makeKpiWidget();
const since = clockTime(makeTrend([1, 2]).previous?.at ?? "");

const renderTrend = (values: number[]) =>
  render(
    <div style={{ width: 240 }}>
      <WidgetTrend spec={spec} trend={makeTrend(values)} widgetId="w-mrr" />
    </div>
  );

describe("widgetTrend", () => {
  beforeEach(() => {
    reduced.value = false;
    resetDrawnSparklines();
  });

  it("renders nothing before two samples, never a 0%", async () => {
    const screen = renderTrend([48_200]);
    await expect.poll(() => screen.container.textContent).toBe("");
    expect(screen.getByTestId("widget-trend").query()).toBeNull();
  });

  it("shows a falling delta with sign, arrow and a spoken label", async () => {
    const screen = renderTrend([50_000, 49_000, 48_000]);
    const chip = screen.getByRole("img", {
      name: /^Down 2% since \d/u,
    });
    await expect.element(chip).toHaveTextContent("▼ 2%");
    await expect.element(chip).toHaveAttribute("data-direction", "down");
    expect(screen.getByTestId("widget-trend").element()).toMatchSnapshot();
  });

  it("shows a rise and a flat line in their own tones", async () => {
    const up = renderTrend([40, 50]);
    await expect
      .element(up.getByRole("img", { name: `Up 25% since ${since}` }))
      .toHaveClass("text-success-ink");
    up.unmount();
    const flat = renderTrend([50, 50]);
    await expect
      .element(flat.getByRole("img", { name: `Unchanged since ${since}` }))
      .toHaveClass("text-panel-muted");
  });

  it("draws the sparkline once, hidden from assistive tech", async () => {
    const first = renderTrend([1, 3, 2]);
    const line = first.getByTestId("sparkline");
    await expect.element(line).toHaveAttribute("data-motion", "draw");
    await expect.element(line).toHaveAttribute("aria-hidden", "true");
    first.unmount();
    const again = renderTrend([1, 3, 2]);
    await expect
      .element(again.getByTestId("sparkline"))
      .toHaveAttribute("data-motion", "static");
  });

  it("slides one step when a new sample arrives", async () => {
    const screen = renderTrend([1, 2, 3]);
    await screen.rerender(
      <div style={{ width: 240 }}>
        <WidgetTrend
          spec={spec}
          trend={makeTrend([1, 2, 3, 4])}
          widgetId="w-mrr"
        />
      </div>
    );
    await expect
      .element(screen.getByRole("img", { name: /^Up 33/u }))
      .toHaveTextContent("▲ 33%");
  });

  it("stays static with reduced motion", async () => {
    reduced.value = true;
    const screen = renderTrend([1, 2]);
    await expect
      .element(screen.getByTestId("sparkline"))
      .toHaveAttribute("data-motion", "static");
  });

  it("says when the last refresh failed", async () => {
    const screen = render(
      <WidgetTrend
        failure={{ since: "2026-11-19T09:41:00.000Z" }}
        spec={spec}
        trend={makeTrend([1, 2])}
        widgetId="w-mrr"
      />
    );
    await expect
      .element(screen.getByText(/^Couldn't refresh since/u))
      .toBeVisible();
    await screen.rerender(
      <WidgetTrend
        failure={{ since: null }}
        spec={spec}
        trend={null}
        widgetId="w-mrr"
      />
    );
    await expect.element(screen.getByText("Couldn't refresh")).toBeVisible();
  });
});

describe("sparkPoints", () => {
  it("spreads points across the width and centers a flat series", () => {
    const points = sparkPoints([1, 1]);
    expect(points.map((point) => point.y)).toStrictEqual([7, 7]);
    expect(points.at(-1)?.x).toBe(46);
  });
});
