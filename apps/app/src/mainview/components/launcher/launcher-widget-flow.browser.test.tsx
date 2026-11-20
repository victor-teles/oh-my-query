import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { Widget } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { LauncherPanel } from "./launcher-panel";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const setup = () => {
  let widgets: Widget[] = [makeWidget()];
  const calls = {
    ask: vi.fn(),
    cancelWidgetRun: vi.fn(),
    proposeWidgetParams: vi.fn(),
    runWidget: vi.fn(() => runResult()),
  };
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ...calls,
      listWidgets: () => widgets,
      saveWidget: (payload) => {
        const saved = {
          ...makeWidget(),
          ...(payload.widget as object),
        } as Widget;
        widgets = [saved];
        return saved;
      },
    },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  // Recharts adds a measuring span to <body>, so query the whole page.
  return { calls, screen: page };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("launcher widget navigation with %s", (_label, isReduced) => {
  beforeEach(() => {
    reduced.value = isReduced;
  });

  it("opens a widget from root, edits its inputs and comes back", async () => {
    const { calls, screen } = setup();
    const search = screen.getByRole("combobox", { name: "Search commands" });
    await expect
      .element(screen.getByRole("option", { name: /Revenue by region/ }))
      .toBeVisible();
    await search.click();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();
    expect(calls.runWidget).toHaveBeenCalledOnce();
    expect(calls.ask).not.toHaveBeenCalled();
    expect(calls.proposeWidgetParams).not.toHaveBeenCalled();

    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: "Edit Inputs" }).click();
    await expect.element(screen.getByText("Edit inputs")).toBeVisible();
    await screen
      .getByRole("textbox", { name: "Label for region" })
      .fill("Market");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await expect
      .element(screen.getByRole("combobox", { name: "Market" }))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeVisible();
  });
});
