import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Watch, Widget } from "@/lib/ipc";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeKpiWidget, makeStatus, makeWatch } from "@/test/watch-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { SAVED_HOLD_MS } from "./use-watch-form";
import { WatchView } from "./watch-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

interface SetupOptions {
  widget?: Widget;
  watches?: Watch[];
  production?: boolean;
  saveWatch?: (payload: Record<string, unknown>) => unknown;
}

const setup = ({
  widget = makeKpiWidget(),
  watches = [],
  production = false,
  saveWatch = (payload) => ({ ...makeWatch(), ...(payload.watch as object) }),
}: SetupOptions = {}) => {
  const ipc = {
    deleteWatch: vi.fn(() => null),
    saveWatch: vi.fn(saveWatch),
  };
  mockLauncherIpc({
    connections: [
      makeConnection({
        environment: production ? "prod" : "dev",
        id: "analytics",
        name: "analytics",
      }),
    ],
    handlers: {
      ...ipc,
      listWatchStatuses: () => watches.map(() => makeStatus()),
      listWatches: () => watches,
      listWidgets: () => [widget],
    },
  });
  const onBack = vi.fn();
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <WatchView onBack={onBack} widgetId={widget.id} />
    </div>
  );
  return { ipc, onBack, screen };
};

describe("watchView", () => {
  beforeEach(() => {
    reduced.value = false;
  });

  it("starts a new watch every five minutes with no alert", async () => {
    const { screen } = setup();
    await expect
      .element(screen.getByRole("heading", { name: "Watch MRR" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("radio", { exact: true, name: "5 min" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("radio", { name: "None" }))
      .toHaveAttribute("aria-checked", "true");
    await expect.element(screen.getByText("Not watched yet")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("hides the menu bar and thresholds for a widget that isn't a KPI", async () => {
    const { screen } = setup({ widget: makeWidget() });
    await expect
      .element(screen.getByText("Only KPI widgets can show in the menu bar."))
      .toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Show in menu bar" }).query()
    ).toBeNull();
    expect(screen.getByRole("radio", { name: "Below" }).query()).toBeNull();
    await expect
      .element(screen.getByRole("radio", { name: "Has rows" }))
      .toBeVisible();
  });

  it("previews the threshold in the widget's format and flags bad input", async () => {
    const { screen } = setup();
    await screen.getByRole("radio", { name: "Below" }).click();
    const field = screen.getByRole("textbox", { name: "Alert when below" });
    await field.fill("50000");
    await expect.element(screen.getByText("$50k")).toBeVisible();
    await field.fill("lots");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Enter a number, like 50000.");
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
  });

  it("saves with ⌘↵, says it's watching, then goes back", async () => {
    const { ipc, onBack, screen } = setup();
    await screen.getByRole("radio", { name: "1 min" }).click();
    await screen.getByRole("checkbox", { name: "Show in menu bar" }).click();
    await screen.getByRole("radio", { name: "Below" }).click();
    await screen
      .getByRole("textbox", { name: "Alert when below" })
      .fill("50000");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    expect(ipc.saveWatch).toHaveBeenCalledWith({
      watch: {
        alert: { kind: "below", threshold: 50_000 },
        interval: "1m",
        menuBar: true,
        paused: false,
        values: { period: "last30d" },
        widgetId: "w-mrr",
      },
    });
    await expect
      .element(screen.getByText("Watching · every min"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("img", { name: "Saved" }))
      .toBeVisible();
    await expect
      .poll(() => onBack.mock.calls.length, {
        timeout: SAVED_HOLD_MS * 3,
      })
      .toBe(1);
  });

  it("shows why a save failed and stays open", async () => {
    const { onBack, screen } = setup({
      saveWatch: () => {
        throw new Error("You can watch up to 20 widgets.");
      },
    });
    await screen.getByRole("radio", { name: "15 min" }).click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("You can watch up to 20 widgets.");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("edits an existing watch and stops it only on a second ⌘⌫", async () => {
    const { ipc, onBack, screen } = setup({
      watches: [makeWatch({ alert: { kind: "changed" }, interval: "15m" })],
    });
    await expect
      .element(screen.getByRole("radio", { name: "Changes" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByText(/^Every 15 min · next/u))
      .toBeVisible();
    await screen.getByRole("radio", { name: "15 min" }).click();
    await userEvent.keyboard("{Meta>}{Backspace}{/Meta}");
    await expect.element(screen.getByText("Press again to stop")).toBeVisible();
    expect(ipc.deleteWatch).not.toHaveBeenCalled();
    await userEvent.keyboard("{Meta>}{Backspace}{/Meta}");
    expect(ipc.deleteWatch).toHaveBeenCalledWith({ watchId: "watch-mrr" });
    await expect.poll(() => onBack.mock.calls.length).toBe(1);
  });

  it("offers the last run's inputs and names production connections", async () => {
    const { screen } = setup({
      production: true,
      watches: [makeWatch({ values: { period: "ytd" } })],
      widget: makeKpiWidget({ lastValues: { period: "last7d" } }),
    });
    await expect.element(screen.getByText("Year to date")).toBeVisible();
    await screen
      .getByRole("button", { name: "Use the inputs from your last run" })
      .click();
    await expect.element(screen.getByText("Last 7 days")).toBeVisible();
    await expect
      .element(
        screen.getByText("Runs every 5 minutes on analytics (production).")
      )
      .toBeVisible();
  });

  it("collapses the threshold instantly with reduced motion", async () => {
    reduced.value = true;
    const { screen } = setup();
    await screen.getByRole("radio", { name: "Above" }).click();
    await expect
      .element(screen.getByRole("textbox", { name: "Alert when above" }))
      .toBeVisible();
    await screen.getByRole("radio", { name: "None" }).click();
    await expect
      .poll(() =>
        screen.getByRole("textbox", { name: "Alert when above" }).query()
      )
      .toBeNull();
  });

  it("says when the widget is gone", async () => {
    mockLauncherIpc({ handlers: { listWidgets: () => [] } });
    const screen = renderWithConnections(
      <WatchView onBack={vi.fn()} widgetId="missing" />
    );
    await expect
      .element(screen.getByText("This widget no longer exists."))
      .toBeVisible();
  });
});
