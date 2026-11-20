import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { ClipboardLookupRow } from "./clipboard-lookup-row";

const checkbox = () =>
  page.getByRole("checkbox", { name: "Suggest lookups from the clipboard" });

describe("clipboardLookupRow", () => {
  it("explains what is read and saves a change", async () => {
    const setClipboardLookups = vi.fn((payload: Record<string, unknown>) => ({
      enabled: payload.enabled,
    }));
    mockLauncherIpc({ handlers: { setClipboardLookups } });
    renderWithConnections(<ClipboardLookupRow />);

    await expect.element(checkbox()).not.toBeChecked();
    await expect
      .element(page.getByText(/Read only when you open the launcher/))
      .toBeVisible();
    await checkbox().click();
    await expect.element(checkbox()).toBeChecked();
    expect(setClipboardLookups).toHaveBeenCalledWith({ enabled: true });
  });

  it("puts the box back and says so when saving fails", async () => {
    mockLauncherIpc({
      handlers: {
        getClipboardLookups: () => ({ enabled: true }),
        setClipboardLookups: () => {
          throw new Error("Disk is full.");
        },
      },
    });
    renderWithConnections(<ClipboardLookupRow />);
    await checkbox().click();
    await expect.element(page.getByText("Disk is full.")).toBeVisible();
    await expect.element(checkbox()).toBeChecked();
  });

  it("offers a retry when the setting can't be read", async () => {
    const read = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Settings could not be read.");
      })
      .mockReturnValue({ enabled: false });
    mockLauncherIpc({ handlers: { getClipboardLookups: () => read() } });
    renderWithConnections(<ClipboardLookupRow />);
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Settings could not be read.");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect.element(checkbox()).toBeVisible();
  });
});
