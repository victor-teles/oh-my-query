import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { mockTauri } from "@/test/tauri-mock";

import { SettingsFeedbackProvider } from "./settings-feedback-context";
import { UpdateChannelSection } from "./update-channel-section";

const renderSection = () =>
  render(
    <SettingsFeedbackProvider>
      <UpdateChannelSection />
    </SettingsFeedbackProvider>
  );

describe("updateChannelSection", () => {
  it("shows three channel options with Nightly disabled", async () => {
    mockTauri({ getUpdateChannel: () => "stable" });
    const screen = renderSection();

    const stable = screen.getByRole("button", { name: /Stable/ });
    const beta = screen.getByRole("button", { name: /Beta/ });
    const nightly = screen.getByRole("button", { name: /Nightly/ });

    await expect.element(stable).toBeInTheDocument();
    expect(stable.element().hasAttribute("disabled")).toBeFalsy();
    expect(beta.element().hasAttribute("disabled")).toBeFalsy();
    expect(nightly.element().hasAttribute("disabled")).toBeTruthy();
  });

  it("writes the channel and surfaces the restart prompt", async () => {
    let stored = "stable";
    mockTauri({
      getUpdateChannel: () => stored,
      setUpdateChannel: (payload) => {
        stored = payload.channel as string;
        return stored;
      },
    });

    const screen = renderSection();

    await screen.getByRole("button", { name: /Beta/ }).click();

    await expect
      .element(
        screen.getByText(/Restart oh-my-query to start receiving updates/i)
      )
      .toBeInTheDocument();
    expect(stored).toBe("beta");
  });

  it("renders the up-to-date confirmation after a check", async () => {
    mockTauri({
      checkForUpdate: () => null,
      getUpdateChannel: () => "stable",
    });

    const screen = renderSection();

    await screen.getByRole("button", { name: /Check now/i }).click();

    await expect.element(screen.getByText(/up to date/i)).toBeInTheDocument();
  });

  it("offers Install & restart when an update is available", async () => {
    mockTauri({
      checkForUpdate: () => ({
        currentVersion: "0.0.10",
        date: null,
        notes: "Bug fixes",
        version: "0.0.11",
      }),
      getUpdateChannel: () => "stable",
    });

    const screen = renderSection();

    await screen.getByRole("button", { name: /Check now/i }).click();

    await expect
      .element(screen.getByText(/Update available/i))
      .toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Install & restart/i })
    ).toBeInTheDocument();
  });
});
