import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockTauri } from "@/test/tauri-mock";

import { SettingsFeedbackProvider } from "./settings-feedback-context";
import { UpdateChannelSection } from "./update-channel-section";

const enableTauri = () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
    writable: true,
  });
};

const renderSection = () =>
  render(
    <SettingsFeedbackProvider>
      <UpdateChannelSection />
    </SettingsFeedbackProvider>
  );

describe("updateChannelSection (web)", () => {
  it("renders the desktop-only empty state when not in Tauri", () => {
    renderSection();
    expect(screen.getByText(/only work in the desktop app/i)).toBeDefined();
  });
});

describe("updateChannelSection (tauri)", () => {
  it("shows three channel options with Nightly disabled", async () => {
    enableTauri();
    mockTauri({ get_update_channel: () => "stable" });
    renderSection();

    const stable = await screen.findByRole("button", { name: /Stable/ });
    const beta = screen.getByRole("button", { name: /Beta/ });
    const nightly = screen.getByRole("button", { name: /Nightly/ });

    expect(stable.hasAttribute("disabled")).toBeFalsy();
    expect(beta.hasAttribute("disabled")).toBeFalsy();
    expect(nightly.hasAttribute("disabled")).toBeTruthy();
  });

  it("writes the channel and surfaces the restart prompt", async () => {
    enableTauri();
    let stored = "stable";
    mockTauri({
      get_update_channel: () => stored,
      set_update_channel: (payload) => {
        stored = payload.channel as string;
        return stored;
      },
    });

    renderSection();

    const betaButton = await screen.findByRole("button", { name: /Beta/ });
    await userEvent.click(betaButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Restart oh-my-query to start receiving updates/i)
      ).toBeDefined();
    });
    expect(stored).toBe("beta");
  });

  it("renders the up-to-date confirmation after a check", async () => {
    enableTauri();
    mockTauri({
      check_for_update: () => null,
      get_update_channel: () => "stable",
    });

    renderSection();

    const checkButton = await screen.findByRole("button", {
      name: /Check now/i,
    });
    await userEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/up to date/i)).toBeDefined();
    });
  });

  it("offers Install & restart when an update is available", async () => {
    enableTauri();
    mockTauri({
      check_for_update: () => ({
        currentVersion: "0.0.10",
        date: null,
        notes: "Bug fixes",
        version: "0.0.11",
      }),
      get_update_channel: () => "stable",
    });

    renderSection();

    const checkButton = await screen.findByRole("button", {
      name: /Check now/i,
    });
    await userEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/Update available/i)).toBeDefined();
    });
    expect(
      screen.getByRole("button", { name: /Install & restart/i })
    ).toBeDefined();
  });
});
