import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { WidgetRunResult } from "@/lib/ipc";

import { initialWidgetRun } from "@/components/widgets/widget-run-reducer";
import { makeTrend } from "@/test/watch-fixtures";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { BoardTile } from "./board-tile";

const handlers = {
  onAction: vi.fn(),
  onDragStart: vi.fn(),
  onEditKey: vi.fn(),
  onRetry: vi.fn(),
  onView: vi.fn(),
};

const renderTile = (outcome: WidgetRunResult) =>
  render(
    <div style={{ height: 320, position: "relative", width: 480 }}>
      <BoardTile
        cue={{ fresh: false, tint: null }}
        editing={false}
        handlers={handlers}
        run={{
          ...initialWidgetRun(outcome.values),
          completedRuns: 1,
          outcome,
          status: "done",
        }}
        tile={{ id: "t1", size: "m", widgetId: "w-revenue" }}
        widget={makeWidget()}
      />
    </div>
  );

describe("boardTile trend", () => {
  it("shows the change since the last run next to the tile actions", async () => {
    const screen = renderTile({
      ...runResult(),
      trend: makeTrend([120_000, 123_000]),
    });
    await expect
      .element(screen.getByRole("img", { name: /^Up 2.5% since/u }))
      .toHaveTextContent("▲ 2.5%");
    await expect
      .element(screen.getByRole("button", { name: /^Actions for/u }))
      .toBeVisible();
  });

  it("shows no trend before a second sample", async () => {
    const screen = renderTile({ ...runResult(), trend: makeTrend([1]) });
    await expect
      .element(screen.getByRole("button", { name: /^Actions for/u }))
      .toBeVisible();
    expect(screen.getByTestId("widget-trend").query()).toBeNull();
  });
});
