import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { SqlAssumptions } from "@/lib/ipc";

import { AssumptionsLine } from "./assumptions-line";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const POPULATED: SqlAssumptions = {
  items: [
    { kind: "table", name: "orders" },
    { kind: "table", name: "regions" },
    { column: "orders.created_at", grain: "month", kind: "time" },
    { column: "status", kind: "filter", text: "status <> 'refunded'" },
    { kind: "limit", rows: 500 },
  ],
};
const FILTER_ONLY: SqlAssumptions = {
  items: [{ column: "status", kind: "filter", text: "status = 'paid'" }],
};

const BY_QUARTER: SqlAssumptions = {
  items: POPULATED.items.map((item) =>
    item.kind === "time" ? { ...item, grain: "quarter" } : item
  ),
};

const settle = () =>
  expect
    .poll(() => document.querySelector('[data-slot="swap-text"] > span + span'))
    .toBeNull();

describe.each([
  ["full motion", false, 1],
  ["reduced motion", true, 0],
])("assumptionsLine with %s", (_label, isReduced, pulses) => {
  it("pre-fills a refine from a chip without running it", async () => {
    reduced.value = isReduced;
    const onPrefill = vi.fn();
    const screen = render(
      <AssumptionsLine
        assumptions={POPULATED}
        interactive
        onPrefill={onPrefill}
      />
    );
    await screen
      .getByRole("button", { name: "Group by week instead of month" })
      .click();
    expect(onPrefill).toHaveBeenCalledWith({
      selection: [9, 13],
      text: "group by week instead of by month",
    });
    await screen
      .getByRole("button", { name: "Refine to show all rows" })
      .click();
    expect(onPrefill).toHaveBeenLastCalledWith({
      selection: null,
      text: "show all rows, not only the top 500",
    });
    expect(
      screen.getByText("orders, regions").element().closest("button")
    ).toBeNull();
  });

  it("swaps a changed chip in place and pulses it once with full motion", async () => {
    reduced.value = isReduced;
    const screen = render(
      <AssumptionsLine
        assumptions={POPULATED}
        interactive
        onPrefill={vi.fn()}
      />
    );
    await screen.rerender(
      <AssumptionsLine
        assumptions={BY_QUARTER}
        interactive
        onPrefill={vi.fn()}
      />
    );
    await expect
      .element(screen.getByText("orders.created_at · by quarter"))
      .toBeVisible();
    expect(screen.getByTestId("chip-pulse").elements()).toHaveLength(pulses);
  });
});

describe("assumptionsLine states", () => {
  it.each([
    ["populated", POPULATED],
    ["filter only", FILTER_ONLY],
  ])("matches the %s snapshot", async (_label, assumptions) => {
    reduced.value = true;
    const screen = render(
      <AssumptionsLine
        assumptions={assumptions}
        interactive
        onPrefill={vi.fn()}
      />
    );
    const line = screen.getByRole("list", { name: "Assumptions" });
    await expect.element(line).toBeVisible();
    await settle();
    expect(line.element()).toMatchSnapshot();
  });

  it("renders nothing and reserves no space without assumptions", async () => {
    reduced.value = true;
    const screen = render(
      <AssumptionsLine assumptions={null} interactive onPrefill={vi.fn()} />
    );
    expect(screen.container.innerHTML).toBe("");
    await screen.rerender(
      <AssumptionsLine
        assumptions={{ items: [] }}
        interactive
        onPrefill={vi.fn()}
      />
    );
    expect(screen.container.innerHTML).toBe("");
  });

  it("keeps chips as plain text when the answer can't be refined", async () => {
    reduced.value = true;
    const screen = render(
      <AssumptionsLine
        assumptions={POPULATED}
        interactive={false}
        onPrefill={vi.fn()}
      />
    );
    await expect.element(screen.getByText("top 500")).toBeVisible();
    expect(screen.getByRole("button").query()).toBeNull();
  });
});
