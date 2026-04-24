import { describe, expect, it, vi } from "vitest";

import { openExternal } from "@/lib/open-external";

const openUrl = vi
  .fn<(url: string | URL, openWith?: string) => Promise<void>>()
  .mockResolvedValue();
vi.mock(import("@tauri-apps/plugin-opener"), () => ({
  openUrl,
}));

function setTauri(active: boolean): void {
  if (active) {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    return;
  }
  // biome-ignore lint/performance/noDelete: cleanup of injected global
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

describe("openExternal", () => {
  it("uses the Tauri opener when running inside Tauri", async () => {
    openUrl.mockClear();
    setTauri(true);

    await openExternal("https://example.com");

    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    setTauri(false);
  });

  it("falls back to window.open in browser mode", async () => {
    openUrl.mockClear();
    setTauri(false);
    const spy = vi.spyOn(window, "open").mockReturnValue(null);

    await openExternal("https://example.com");

    expect(openUrl).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );
    spy.mockRestore();
  });
});
