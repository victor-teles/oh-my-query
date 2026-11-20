import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import {
  askStateAfter,
  refineStateAfter,
  REVENUE,
  withRecordedAssumptions,
} from "@/test/ask-fixtures";
import { renderAskView } from "@/test/ask-view-harness";

import type { AskState } from "./ask-reducer";

import { askReducer } from "./ask-reducer";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const answered = () => withRecordedAssumptions(askStateAfter(REVENUE));

const refining = () =>
  refineStateAfter(answered(), "only Europe", { nth: 4, type: "sqlDelta" });

const refined = () =>
  withRecordedAssumptions(refineStateAfter(answered(), "only Europe"));

const refineFailed = (): AskState =>
  askReducer(refineStateAfter(answered(), "only Europe", { type: "phase" }), {
    code: "QUERY_FAILED",
    message: 'column "plan" does not exist',
    phase: "run",
    type: "error",
  });

const atLimit = (): AskState => {
  let state = answered();
  for (const prompt of ["by week", "by month", "sorted", "top five", "2025"]) {
    state = refineStateAfter(state, prompt);
  }
  return state;
};

const settled = (root: Element) =>
  expect
    .poll(() => root.querySelector('[data-slot="swap-text"] > span + span'))
    .toBeNull();

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("the refining card with %s", (_label, isReduced) => {
  it("dims the shown card under a progress line and keeps its height", async () => {
    reduced.value = isReduced;
    const { screen } = await renderAskView(refining());
    const stage = screen.getByTestId("answer-stage");
    await expect.element(stage).toHaveAttribute("aria-busy", "true");
    await expect
      .poll(() => Number(getComputedStyle(stage.element()).opacity))
      .toBeCloseTo(0.6, 1);
    await expect
      .element(screen.getByTestId("run-progress"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { name: /by region/ }))
      .toBeVisible();
    expect(screen.getByRole("status").query()).toBeNull();
  });

  it("dims the previous SQL until the refine streams its own", async () => {
    reduced.value = isReduced;
    const expanded = askReducer(answered(), { type: "toggleSql" });
    const { screen } = await renderAskView(
      refineStateAfter(expanded, "only Europe", { type: "phase" })
    );
    const block = screen.getByRole("region", { name: "Generated SQL" });
    await expect.element(block).toHaveAttribute("data-state", "stopped");
    await expect.element(block).toHaveTextContent("by region in 2026");
  });

  it("shows a failed refine above the restored card without the progress line", async () => {
    reduced.value = isReduced;
    const { screen } = await renderAskView(refineFailed());
    await expect.element(screen.getByRole("alert")).toBeVisible();
    await expect
      .element(screen.getByTestId("answer-stage"))
      .toHaveAttribute("aria-busy", "false");
    expect(screen.getByTestId("run-progress").query()).toBeNull();
  });

  it("swaps the placeholder at the turn limit", async () => {
    reduced.value = isReduced;
    const { screen } = await renderAskView(atLimit());
    await expect
      .element(screen.getByText("Start a new question with ⌘↵"))
      .toBeVisible();
    await expect
      .element(screen.getByText("New question", { exact: true }))
      .toBeVisible();
  });
});

describe("refine states", () => {
  it.each<[string, () => AskState, RegExp | string]>([
    ["refining", refining, "Writing SQL"],
    ["refined with trail and assumptions", refined, "in Europe"],
    ["refine error over the restored card", refineFailed, "The query failed."],
    ["turn limit reached", atLimit, "Start a new question"],
  ])("matches the %s snapshot", async (_label, state, marker) => {
    reduced.value = true;
    await page
      .elementLocator(document.body)
      .hover({ position: { x: 0, y: 0 } });
    const { screen } = await renderAskView(state());
    await expect
      .element(screen.getByText(marker, { exact: false }).first())
      .toBeVisible();
    await settled(screen.element());
    expect(screen.element()).toMatchSnapshot();
  });
});
