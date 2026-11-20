import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { Widget } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import {
  LOCAL_CONNECTIONS,
  makeBundle,
  makeImportResult,
  makePlan,
} from "@/test/bundle-fixtures";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import { LauncherPanel } from "./launcher-panel";

const setup = () => {
  let widgets: Widget[] = [];
  const calls = {
    applyImport: vi.fn(() => {
      widgets = [makeWidget({ id: "new-revenue" })];
      return makeImportResult();
    }),
    previewImport: vi.fn(() => ({
      bundle: makeBundle(),
      plan: makePlan(),
      status: "ready",
    })),
  };
  mockLauncherIpc({
    connections: LOCAL_CONNECTIONS,
    handlers: { ...calls, listWidgets: () => widgets },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  return { calls, screen: page };
};

const openImport = async (screen: ReturnType<typeof setup>["screen"]) => {
  const search = screen.getByRole("combobox", { name: "Search commands" });
  await search.fill("import widgets");
  await expect
    .element(screen.getByRole("option", { name: /Import Widgets and Boards/ }))
    .toBeVisible();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByRole("button", { name: /From Clipboard/ }))
    .toHaveFocus();
};

describe("launcher import flow", () => {
  it("imports from the clipboard and returns to root with the new widget selected", async () => {
    const { calls, screen } = setup();
    await openImport(screen);
    await userEvent.keyboard("{Enter}");
    await expect
      .element(
        screen.getByRole("radiogroup", { name: "analytics · PostgreSQL" })
      )
      .toHaveFocus();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("button", { name: "Done" }))
      .toHaveFocus();
    expect(calls.applyImport).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("option", { name: /Revenue by region/ }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("goes back to root with Escape", async () => {
    const { screen } = setup();
    await openImport(screen);
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();
  });
});
