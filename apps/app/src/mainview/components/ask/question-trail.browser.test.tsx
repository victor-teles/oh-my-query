import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { trailCrumbs } from "./ask-trail";
import { QuestionTrail } from "./question-trail";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const PROMPTS = ["Monthly MRR by region", "only Europe", "by quarter"];

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("questionTrail with %s", (_label, isReduced) => {
  it("marks the shown step and steps when a crumb is pressed", async () => {
    reduced.value = isReduced;
    const onStep = vi.fn();
    const screen = render(
      <QuestionTrail
        crumbs={trailCrumbs(PROMPTS, 2, null)}
        onStep={onStep}
        position={2}
      />
    );
    const current = screen.getByRole("button", {
      name: "Show step 3: by quarter",
    });
    await expect.element(current).toHaveAttribute("aria-current", "step");
    await screen
      .getByRole("button", { name: "Show step 1: Monthly MRR by region" })
      .click();
    expect(onStep).toHaveBeenCalledWith(0);
    expect(
      screen.getByRole("navigation", { name: "Question steps" }).element()
    ).toMatchSnapshot();
  });

  it("shows a running follow-up as a pending crumb that fades when stopped", async () => {
    reduced.value = isReduced;
    const screen = render(
      <QuestionTrail
        crumbs={trailCrumbs(PROMPTS.slice(0, 1), 0, "only Europe")}
        onStep={vi.fn()}
        position={0}
      />
    );
    await expect.element(screen.getByText("only Europe")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /only Europe/ }).query()
    ).toBeNull();

    await screen.rerender(
      <QuestionTrail crumbs={[]} onStep={vi.fn()} position={0} />
    );
    await expect.poll(() => screen.getByText("only Europe").query()).toBeNull();
  });
});

describe("questionTrail truncation", () => {
  it("folds hidden steps into one crumb that lists them", async () => {
    reduced.value = true;
    const screen = render(
      <QuestionTrail
        crumbs={trailCrumbs(["a", "b", "c", "d", "e", "f"], 5, null)}
        onStep={vi.fn()}
        position={5}
      />
    );
    const gap = screen.getByRole("img", { name: "3 more steps: b, c, d" });
    await expect.element(gap).toHaveAttribute("title", "b › c › d");
  });
});
