import { describe, expect, it } from "vitest";

import { renderHook } from "@/test/render-hook";

import { CONFIRM_WINDOW_MS, useArmedConfirm } from "./use-armed-confirm";

describe("useArmedConfirm", () => {
  it("arms, then lapses on its own", async () => {
    const { result } = renderHook(() => useArmedConfirm());
    expect(result.current.armed).toBeFalsy();

    result.current.arm();
    await expect.poll(() => result.current.armed).toBeTruthy();
    await expect
      .poll(() => result.current.armed, { timeout: CONFIRM_WINDOW_MS + 500 })
      .toBeFalsy();
  });

  it("disarms on request", async () => {
    const { result } = renderHook(() => useArmedConfirm());
    result.current.arm();
    await expect.poll(() => result.current.armed).toBeTruthy();

    result.current.disarm();
    await expect.poll(() => result.current.armed).toBeFalsy();
  });
});
