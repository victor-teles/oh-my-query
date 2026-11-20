import { describe, expect, it } from "vitest";

import { renderHook } from "@/test/render-hook";
import { wait } from "@/test/wait";

import { SHOW_DELAY_MS, useDelayedVisibility } from "./use-delayed-visibility";

describe("useDelayedVisibility", () => {
  it("never shows a busy state that ends before the delay", async () => {
    const { result, rerender } = renderHook(
      (active: boolean) => useDelayedVisibility(active),
      { initialProps: true }
    );
    expect(result.current).toBeFalsy();
    rerender(false);
    await wait(SHOW_DELAY_MS * 2);
    expect(result.current).toBeFalsy();
  });

  it("shows after the delay and stays up briefly once shown", async () => {
    const { result, rerender } = renderHook(
      (active: boolean) => useDelayedVisibility(active),
      { initialProps: true }
    );
    await expect.poll(() => result.current).toBeTruthy();

    rerender(false);
    await wait(40);
    expect(result.current).toBeTruthy();
    await expect.poll(() => result.current).toBeFalsy();
  });
});
