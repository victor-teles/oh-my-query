import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { RefineOverlay } from "./refine-overlay";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const PLACEHOLDER = "Refine — by month, only Europe, as a table…";

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("refineOverlay with %s", (_label, isReduced) => {
  it("shows the placeholder only while the draft is empty", async () => {
    reduced.value = isReduced;
    const screen = render(
      <RefineOverlay draft="" ghost={null} placeholder={PLACEHOLDER} />
    );
    await expect.element(screen.getByText(PLACEHOLDER)).toBeVisible();
    await screen.rerender(
      <RefineOverlay draft="only" ghost={null} placeholder={PLACEHOLDER} />
    );
    expect(screen.getByText(PLACEHOLDER).query()).toBeNull();
  });

  it("keeps an invisible copy of the follow-up to lift only with full motion", async () => {
    reduced.value = isReduced;
    const screen = render(
      <RefineOverlay
        draft="only Europe"
        ghost={{ index: 1, text: "only Europe" }}
        placeholder={PLACEHOLDER}
      />
    );
    await expect
      .poll(() => screen.getByTestId("refine-ghost").query() !== null)
      .toBe(!isReduced);
  });
});
