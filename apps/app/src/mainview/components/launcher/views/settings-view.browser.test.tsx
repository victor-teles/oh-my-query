import type { RedactedAiSettings } from "@oh-my-query/rpc";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { CommandHandlers } from "@/test/ipc-mock";

import { AppProviders } from "@/components/app-providers";
import { mockLauncherIpc } from "@/test/launcher-ipc";

import { SettingsView } from "./settings-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const STORED: RedactedAiSettings = {
  baseUrl: null,
  hasKey: true,
  keyHint: "a1b2",
  model: null,
  provider: "anthropic",
};

const renderSettings = (handlers: CommandHandlers = {}, onBack = vi.fn()) => {
  mockLauncherIpc({ handlers });
  return render(
    <AppProviders>
      <SettingsView onBack={onBack} onOpenWatches={vi.fn()} />
    </AppProviders>
  );
};

type Screen = ReturnType<typeof renderSettings>;

const aiForm = (screen: Screen) =>
  screen.getByRole("form", { name: "AI provider" });

const resetMotion = () => {
  reduced.value = false;
};

describe("settings view — AI", () => {
  beforeEach(resetMotion);

  it("shows a placeholder while AI settings load", async () => {
    const pending = Promise.withResolvers<null>();
    const screen = renderSettings({ getAiSettings: () => pending.promise });

    await expect
      .element(screen.getByRole("status", { name: "Loading AI settings" }))
      .toBeVisible();
    pending.resolve(null);
    await expect.element(aiForm(screen)).toBeVisible();
  });

  it("starts with an empty key field when nothing is stored", async () => {
    const screen = renderSettings();

    await expect
      .element(screen.getByRole("textbox", { name: "Model" }))
      .toHaveAttribute("placeholder", "claude-opus-5-5 (default)");
    await expect.element(screen.getByLabelText("API key")).toHaveValue("");
    expect(
      screen.getByRole("img", { name: "Stored API key" }).query()
    ).toBeNull();
    expect(aiForm(screen).element()).toMatchSnapshot();
  });

  it("shows a stored key only as its last four characters", async () => {
    const screen = renderSettings({ getAiSettings: () => STORED });

    await expect
      .element(screen.getByRole("img", { name: "Stored API key" }))
      .toHaveTextContent("•••• a1b2");
    expect(aiForm(screen).element()).toMatchSnapshot();
  });

  it("saves without a key when the stored key is untouched", async () => {
    const save = vi.fn(() => ({ ...STORED, model: "claude-haiku-5-5" }));
    const screen = renderSettings({
      getAiSettings: () => STORED,
      saveAiSettings: save,
    });

    await screen.getByRole("button", { name: "claude-haiku-5-5" }).click();
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Saved" }))
      .toBeVisible();
    expect(save).toHaveBeenCalledWith({
      apiKey: undefined,
      baseUrl: undefined,
      model: "claude-haiku-5-5",
      provider: "anthropic",
    });
  });

  it("clears the stored key", async () => {
    const clear = vi.fn(() => ({ ...STORED, hasKey: false, keyHint: null }));
    const screen = renderSettings({
      clearAiKey: clear,
      getAiSettings: () => STORED,
    });

    await screen.getByRole("button", { name: "Clear" }).click();
    await expect.element(screen.getByLabelText("API key")).toHaveValue("");
    expect(clear).toHaveBeenCalledOnce();
  });

  it("asks for a base URL instead of a key for a local model", async () => {
    const screen = renderSettings({ getAiSettings: () => STORED });
    await screen.getByRole("combobox", { name: "Provider" }).click();
    await screen.getByRole("option", { name: /Local/ }).click();

    await expect
      .element(screen.getByRole("textbox", { name: "Base URL" }))
      .toHaveValue("http://localhost:11434/v1");
    expect(screen.getByLabelText("API key").query()).toBeNull();
  });

  it("reports a passing test with its latency", async () => {
    const screen = renderSettings({
      getAiSettings: () => STORED,
      testAiSettings: () => ({
        latencyMs: 412,
        message: "Connected to claude-opus-5-5",
        ok: true,
      }),
    });

    await screen.getByRole("button", { name: "Test" }).click();
    await expect
      .element(screen.getByText("Connected to claude-opus-5-5"))
      .toBeVisible();
    await expect.element(screen.getByText("412 ms")).toBeVisible();
  });

  it("reports a failing test", async () => {
    const screen = renderSettings({
      getAiSettings: () => STORED,
      testAiSettings: () => ({
        latencyMs: 80,
        message: "Invalid API key. Check the key in Settings.",
        ok: false,
      }),
    });

    await screen.getByRole("button", { name: "Test" }).click();
    await expect
      .element(screen.getByRole("img", { name: "Test failed" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Invalid API key. Check the key in Settings."))
      .toBeVisible();
  });

  it("shows a save failure inline", async () => {
    const screen = renderSettings({
      saveAiSettings: vi.fn().mockRejectedValue(new Error("Disk is read-only")),
    });

    await screen.getByLabelText("API key").fill("sk-ant-0123456789");
    await screen.getByRole("button", { name: "Save" }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Disk is read-only");
  });

  it("retries after AI settings fail to load", async () => {
    const getAiSettings = vi
      .fn()
      .mockRejectedValueOnce(new Error("Decryption failed"))
      .mockResolvedValueOnce(null);
    const screen = renderSettings({ getAiSettings: () => getAiSettings() });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Decryption failed");
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.element(aiForm(screen)).toBeVisible();
  });
});

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("replacing the API key with %s", (_label, isReduced) => {
  beforeEach(resetMotion);

  it("swaps the mask for a focused field and sends the new key", async () => {
    reduced.value = isReduced;
    const save = vi.fn(() => ({ ...STORED, keyHint: "wxyz" }));
    const screen = renderSettings({
      getAiSettings: () => STORED,
      saveAiSettings: save,
    });

    await screen.getByRole("button", { name: "Replace" }).click();
    const field = screen.getByLabelText("API key");
    await expect.element(field).toHaveFocus();
    await userEvent.keyboard("sk-ant-new-0000wxyz{Enter}");

    await expect
      .element(screen.getByRole("img", { name: "Stored API key" }))
      .toHaveTextContent("•••• wxyz");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-ant-new-0000wxyz" })
    );
  });

  it("keeps the stored key when the replacement is abandoned", async () => {
    reduced.value = isReduced;
    const screen = renderSettings({ getAiSettings: () => STORED });

    await screen.getByRole("button", { name: "Replace" }).click();
    await screen.getByRole("button", { name: "Keep" }).click();
    await expect
      .element(screen.getByRole("img", { name: "Stored API key" }))
      .toBeVisible();
  });
});

describe("settings view — launcher", () => {
  beforeEach(resetMotion);

  it("shows the configured hotkey", async () => {
    const screen = renderSettings({ getLauncherHotkey: () => "Control+Space" });
    await expect.element(screen.getByLabelText("⌃ Space")).toBeVisible();
  });

  it("reports a hotkey read failure and retries", async () => {
    const getLauncherHotkey = vi
      .fn()
      .mockRejectedValueOnce(new Error("Config file is unreadable."))
      .mockResolvedValueOnce("Option+Shift+Space");
    const screen = renderSettings({
      getLauncherHotkey: () => getLauncherHotkey(),
    });

    await expect
      .element(screen.getByText("Config file is unreadable."))
      .toBeVisible();
    await expect.element(aiForm(screen)).toBeVisible();
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.element(screen.getByLabelText("⌥ ⇧ Space")).toBeVisible();
  });

  it("switches theme with clicks and arrow keys", async () => {
    const screen = renderSettings();
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    const radio = (name: string) => theme.getByRole("radio", { name });

    await expect.element(radio("Dark")).toHaveAttribute("aria-checked", "true");
    await radio("Light").click();
    await expect
      .element(radio("Light"))
      .toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.classList.contains("light")).toBeTruthy();

    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(radio("Dark")).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect
      .element(radio("System"))
      .toHaveAttribute("aria-checked", "true");
  });

  it("goes back from the header button", async () => {
    const onBack = vi.fn();
    const screen = renderSettings({}, onBack);
    await screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("settings view — about", () => {
  beforeEach(resetMotion);

  it("shows the version and changes the update channel", async () => {
    const setChannel = vi.fn(
      (payload: Record<string, unknown>) => payload.channel
    );
    const screen = renderSettings({ setUpdateChannel: setChannel });

    await expect.element(screen.getByText("1.4.0")).toBeVisible();
    const channels = screen.getByRole("radiogroup", { name: "Update channel" });
    await channels.getByRole("radio", { name: "Beta" }).click();

    await expect
      .element(channels.getByRole("radio", { name: "Beta" }))
      .toHaveAttribute("aria-checked", "true");
    expect(setChannel).toHaveBeenCalledWith({ channel: "beta" });
  });

  it("reverts the channel when it cannot be saved", async () => {
    const screen = renderSettings({
      setUpdateChannel: vi.fn().mockRejectedValue(new Error("nope")),
    });
    const channels = screen.getByRole("radiogroup", { name: "Update channel" });
    await channels.getByRole("radio", { name: "Nightly" }).click();

    await expect
      .element(channels.getByRole("radio", { name: "Stable" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("checks for updates and reports being current", async () => {
    const screen = renderSettings({ checkForUpdate: () => null });
    await screen.getByRole("button", { name: "Check Now" }).click();
    await expect
      .element(screen.getByText("You're on the latest version."))
      .toBeVisible();
  });

  it("offers to install an available update", async () => {
    const install = vi.fn(() => true);
    const screen = renderSettings({
      checkForUpdate: () => ({
        currentVersion: "1.4.0",
        date: null,
        notes: null,
        version: "1.5.0",
      }),
      installUpdate: install,
    });

    await screen.getByRole("button", { name: "Check Now" }).click();
    await expect
      .element(screen.getByText("Version 1.5.0 is ready to install."))
      .toBeVisible();
    await screen.getByRole("button", { name: "Install and Restart" }).click();
    await expect.element(screen.getByText("Installing 1.5.0…")).toBeVisible();
    expect(install).toHaveBeenCalledOnce();
  });

  it("reports a failed update check", async () => {
    const screen = renderSettings({
      checkForUpdate: vi.fn().mockRejectedValue(new Error("Offline")),
    });
    await screen.getByRole("button", { name: "Check Now" }).click();
    await expect.element(screen.getByText("Offline")).toBeVisible();
  });
});

describe("settings view — background", () => {
  beforeEach(resetMotion);

  it("opens the watched widgets", async () => {
    mockLauncherIpc();
    const onOpenWatches = vi.fn();
    const screen = render(
      <AppProviders>
        <SettingsView onBack={vi.fn()} onOpenWatches={onOpenWatches} />
      </AppProviders>
    );
    await expect
      .element(screen.getByRole("region", { name: "Background" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Open watched widgets" }).click();
    expect(onOpenWatches).toHaveBeenCalledOnce();
  });
});
