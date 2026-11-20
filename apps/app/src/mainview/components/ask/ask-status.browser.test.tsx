import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { AskSkeleton } from "./ask-skeleton";
import { AskStatus } from "./ask-status";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const WRITING = {
  primary: "Writing SQL",
  secondary: "Reading the analytics schema",
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("working state with %s", (_label, isReduced) => {
  it("announces the phase once and spins only with motion", async () => {
    reduced.value = isReduced;
    const screen = render(<AskStatus busy label={WRITING} />);
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Writing SQL. Reading the analytics schema");
    const mark = screen.getByTestId("status-mark").element();
    expect(mark.className.includes("animate-spin")).toBe(!isReduced);
  });

  it("swaps to the next phase", async () => {
    reduced.value = isReduced;
    const screen = render(<AskStatus busy label={WRITING} />);
    await screen.rerender(
      <AskStatus
        busy
        label={{
          primary: "Running query",
          secondary: "Read only on analytics",
        }}
      />
    );
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Running query");
  });

  it("shimmers the skeleton only with motion", () => {
    reduced.value = isReduced;
    const screen = render(<AskSkeleton />);
    const skeleton = screen.getByTestId("ask-skeleton").element();
    expect(skeleton.classList.contains("ask-shimmer")).toBe(!isReduced);
    expect(skeleton.querySelectorAll(".rounded-t-\\[3px\\]")).toHaveLength(12);
  });
});

describe("askStatus", () => {
  it("shows a still dot and no secondary line when stopped", async () => {
    const screen = render(
      <AskStatus busy={false} label={{ primary: "Stopped", secondary: null }} />
    );
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Stopped");
    expect(screen.getByTestId("status-mark").element().className).toContain(
      "size-1.5"
    );
  });
});
