import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import { wait } from "@/test/wait";

import { LauncherPanel } from "./launcher-panel";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const hideLauncher = vi.fn();
const resizeLauncher = vi.fn();

const renderLauncher = () =>
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );

const presenceOf = (screen: ReturnType<typeof render>) =>
  screen.container.querySelector<HTMLElement>("[data-presence]")?.dataset
    .presence;

describe("launcherPanel", () => {
  beforeEach(() => {
    reduced.value = false;
    hideLauncher.mockReset();
    resizeLauncher.mockReset();
    mockLauncherIpc({
      handlers: {
        hideLauncher: () => hideLauncher(),
        resizeLauncher: (payload) => resizeLauncher(payload),
      },
    });
  });

  it("summons on mount with the search field ready", async () => {
    const screen = renderLauncher();

    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toHaveFocus();
    expect(presenceOf(screen)).toBe("shown");
  });

  it("asks bun to size the window to the panel", async () => {
    renderLauncher();

    await expect
      .poll(() => resizeLauncher.mock.calls.length)
      .toBeGreaterThan(0);
    const [{ height }] = resizeLauncher.mock.lastCall as [{ height: number }];
    expect(height).toBeGreaterThan(64);
  });

  it("clears the query before it dismisses", async () => {
    const screen = renderLauncher();
    const input = screen.getByRole("combobox", { name: "Search commands" });
    await input.fill("hid");

    await userEvent.keyboard("{Escape}");
    await expect.element(input).toHaveValue("");
    expect(presenceOf(screen)).toBe("shown");

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => presenceOf(screen)).toBe("hidden");
    await expect.poll(() => hideLauncher.mock.calls.length).toBe(1);
  });

  it("pushes settings and pops back with Escape", async () => {
    const screen = renderLauncher();
    await screen.getByRole("combobox", { name: "Search commands" }).click();

    await userEvent.keyboard("{Meta>},{/Meta}");
    await expect
      .element(screen.getByRole("heading", { name: "Settings" }))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();
    expect(hideLauncher).not.toHaveBeenCalled();
  });

  it.each([
    ["full motion", false],
    ["reduced motion", true],
  ])(
    "pushes History with ⌘Y and pops back with Escape (%s)",
    async (_label, isReduced) => {
      reduced.value = isReduced;
      const screen = renderLauncher();
      await screen.getByRole("combobox", { name: "Search commands" }).click();

      await userEvent.keyboard("{Meta>}y{/Meta}");
      const search = screen.getByRole("combobox", { name: "Search history" });
      await expect.element(search).toHaveFocus();
      await expect.element(screen.getByText("No asks yet.")).toBeVisible();

      await userEvent.keyboard("{Escape}");
      await expect
        .element(screen.getByRole("combobox", { name: "Search commands" }))
        .toBeVisible();
      await expect.element(search).not.toBeInTheDocument();
    }
  );

  it("follows navigate messages from the tray and menu", async () => {
    const screen = renderLauncher();

    emitIpcMessage("launcherNavigate", { view: "settings" });
    await expect
      .element(screen.getByRole("heading", { name: "Settings" }))
      .toBeVisible();

    emitIpcMessage("launcherNavigate", { view: "root" });
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();
  });

  it("reverses a dismissal when toggled again mid-flight", async () => {
    const screen = renderLauncher();
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();

    emitIpcMessage("launcherToggle");
    emitIpcMessage("launcherToggle");

    await expect.poll(() => presenceOf(screen)).toBe("shown");
    await wait(400);
    expect(hideLauncher).not.toHaveBeenCalled();
  });

  it("dismisses on blur and hides once the exit settles", async () => {
    const screen = renderLauncher();
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();

    emitIpcMessage("launcherDismiss");

    await expect.poll(() => hideLauncher.mock.calls.length).toBe(1);
    expect(presenceOf(screen)).toBe("hidden");
  });

  it("hides immediately under reduced motion", async () => {
    reduced.value = true;
    const screen = renderLauncher();
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();

    const started = performance.now();
    emitIpcMessage("launcherDismiss");
    await expect.poll(() => hideLauncher.mock.calls.length).toBe(1);
    expect(performance.now() - started).toBeLessThan(150);
  });

  it("refocuses the field and resets after a long absence", async () => {
    const screen = renderLauncher();
    const input = screen.getByRole("combobox", { name: "Search commands" });
    await input.fill("hid");

    emitIpcMessage("launcherDismiss");
    await expect.poll(() => hideLauncher.mock.calls.length).toBe(1);

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    emitIpcMessage("launcherShown");

    await expect.element(input).toHaveValue("");
    await expect.element(input).toHaveFocus();
    vi.restoreAllMocks();
  });

  it("adds a connection in the editor and selects it back at root", async () => {
    const screen = renderLauncher();
    const input = screen.getByRole("combobox", { name: "Search commands" });
    await expect.element(screen.getByText("No databases yet")).toBeVisible();
    await input.click();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("heading", { name: "New Connection" }))
      .toBeVisible();
    await screen.getByLabelText("Connection name").fill("warehouse");
    await screen.getByLabelText("Database", { exact: true }).fill("events");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await expect.element(screen.getByText("Saved")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toHaveAttribute(
        "aria-activedescendant",
        expect.stringContaining("launcher-option-")
      );
    await expect
      .element(screen.getByRole("option", { name: /warehouse/ }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("pops the editor with Escape", async () => {
    const screen = renderLauncher();
    await expect.element(screen.getByText("No databases yet")).toBeVisible();
    await screen.getByRole("combobox", { name: "Search commands" }).click();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("heading", { name: "New Connection" }))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();
    expect(hideLauncher).not.toHaveBeenCalled();
  });
});
