import { describe, expect, it, vi } from "vitest";

const noop = async (): Promise<void> => {
  /* mocked openExternal */
};
const openExternalMock = vi.fn<() => Promise<void>>(noop);

vi.mock(import("@/lib/ipc"), () => ({
  openExternal: openExternalMock,
}));

describe("openExternal", () => {
  it("delegates to the IPC openExternal call", async () => {
    const { openExternal } = await import("@/lib/open-external");
    openExternalMock.mockClear();

    await openExternal("https://example.com");

    expect(openExternalMock).toHaveBeenCalledWith("https://example.com");
  });
});
