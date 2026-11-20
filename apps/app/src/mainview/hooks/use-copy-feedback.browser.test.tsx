import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-hook";

import { COPIED_FOR_MS, useCopyFeedback } from "./use-copy-feedback";

describe("useCopyFeedback", () => {
  it("copies the text and reports copied until the feedback times out", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { result } = renderHook(() => useCopyFeedback());

    await result.current.copy("select 1");
    expect(writeText).toHaveBeenCalledWith("select 1");
    await expect.poll(() => result.current.copied).toBeTruthy();
    await expect
      .poll(() => result.current.copied, { timeout: COPIED_FOR_MS * 2 })
      .toBeFalsy();
  });

  it("falls back to a selection copy when the clipboard API refuses", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied")
    );
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);
    const { result } = renderHook(() => useCopyFeedback());

    await result.current.copy("select 2");
    expect(execCommand).toHaveBeenCalledWith("copy");
    await expect.poll(() => result.current.copied).toBeTruthy();
  });

  it("stays quiet when nothing could be copied", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied")
    );
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    const { result } = renderHook(() => useCopyFeedback());

    await result.current.copy("select 3");
    expect(result.current.copied).toBeFalsy();
  });
});
