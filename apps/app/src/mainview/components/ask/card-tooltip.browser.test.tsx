import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { chartModelOf, pieModelOf } from "@/lib/card-data";
import { revenue, signups } from "@/test/card-fixtures";

import { CardTooltip } from "./card-tooltip";

const chartView = () => {
  const { view } = revenue.spec;
  if (view.kind !== "chart") {
    throw new Error("revenue fixture is not a chart");
  }
  return view;
};

describe("cardTooltip", () => {
  it("formats the x label and each series value", async () => {
    const model = chartModelOf(
      chartView(),
      revenue.result,
      revenue.spec.formats
    );
    const screen = render(
      <CardTooltip
        active
        label="2026-09-01"
        model={model}
        payload={[
          { dataKey: "s0", value: 258_000 },
          { dataKey: "s2", value: 71_000 },
        ]}
      />
    );
    await expect.element(screen.getByText("Sep 2026")).toBeVisible();
    await expect.element(screen.getByText("$258k")).toBeVisible();
    await expect.element(screen.getByText("Asia Pacific")).toBeVisible();
    expect(screen.getByText("Europe").query()).toBeNull();
  });

  it("reads pie slices by their datum key and renders nothing when inactive", async () => {
    const model = pieModelOf(
      { kind: "pie", label: "week", value: "free" },
      signups.result,
      signups.spec.formats
    );
    const screen = render(
      <CardTooltip
        active
        model={model}
        payload={[{ dataKey: "value", payload: { key: "s0" }, value: 534 }]}
      />
    );
    await expect.element(screen.getByText("534")).toBeVisible();

    await screen.rerender(
      <CardTooltip active={false} model={model} payload={[]} />
    );
    expect(screen.getByText("534").query()).toBeNull();
  });
});
