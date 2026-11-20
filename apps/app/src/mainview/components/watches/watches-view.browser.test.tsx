import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Watch, WatchStatus } from "@/lib/ipc";

import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeKpiWidget, makeStatus, makeWatch } from "@/test/watch-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { WatchesView } from "./watches-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const watched = [
  makeWatch({ menuBar: true }),
  makeWatch({
    alert: { kind: "hasRows" },
    id: "watch-revenue",
    widgetId: "w-revenue",
  }),
];

interface SetupOptions {
  watches?: Watch[];
  statuses?: WatchStatus[];
  listWatches?: () => unknown;
  paused?: boolean;
}

const setup = ({
  watches = watched,
  statuses = [
    makeStatus(),
    makeStatus({
      display: null,
      error: { code: "QUERY_FAILED", message: "Timed out." },
      state: "error",
      watchId: "watch-revenue",
    }),
  ],
  listWatches = () => watches,
  paused = false,
}: SetupOptions = {}) => {
  const ipc = {
    deleteWatch: vi.fn(() => null),
    setWatchingPaused: vi.fn((_payload: Record<string, unknown>) => null),
  };
  const state = { paused };
  mockLauncherIpc({
    handlers: {
      ...ipc,
      getWatchingPaused: () => state.paused,
      listWatchStatuses: () => statuses,
      listWatches,
      listWidgets: () => [makeKpiWidget(), makeWidget()],
      setWatchingPaused: (payload) => {
        state.paused = payload.paused as boolean;
        return ipc.setWatchingPaused(payload);
      },
    },
  });
  const onOpenWatch = vi.fn();
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <WatchesView onBack={vi.fn()} onOpenWatch={onOpenWatch} />
    </div>
  );
  return { ipc, onOpenWatch, screen };
};

describe("watchesView", () => {
  beforeEach(() => {
    reduced.value = false;
  });

  it("lists each watch with its value and status", async () => {
    const { screen } = setup();
    const list = screen.getByRole("listbox", { name: "Watched widgets" });
    await expect.element(list).toBeVisible();
    await expect.element(screen.getByText("$48.2k")).toBeVisible();
    await expect
      .element(screen.getByText(/^Every 5 min · next/u))
      .toBeVisible();
    await expect
      .element(screen.getByText("Couldn't refresh: Timed out."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("img", { name: "Shown in the menu bar" }))
      .toBeVisible();
    expect(list.element()).toMatchSnapshot();
  });

  it("opens a watch with ↵ and stops one only on a second ⌫", async () => {
    const { ipc, onOpenWatch, screen } = setup();
    const list = screen.getByRole("listbox", { name: "Watched widgets" });
    await expect.element(list).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onOpenWatch).toHaveBeenCalledWith("w-revenue");

    await userEvent.keyboard("{Backspace}");
    await expect
      .element(screen.getByText("Press ⌫ again to stop watching"))
      .toBeVisible();
    expect(ipc.deleteWatch).not.toHaveBeenCalled();
    await userEvent.keyboard("{Backspace}");
    expect(ipc.deleteWatch).toHaveBeenCalledWith({ watchId: "watch-revenue" });
  });

  it("pauses all watching", async () => {
    const { ipc, screen } = setup();
    const pause = screen.getByRole("checkbox", { name: "Pause all watching" });
    await expect.element(pause).toBeEnabled();
    await pause.click();
    expect(ipc.setWatchingPaused).toHaveBeenCalledWith({ paused: true });
    await expect.element(pause).toBeChecked();
    await expect.element(screen.getByText("Watching is paused")).toBeVisible();
  });

  it("explains how to start when nothing is watched", async () => {
    const { screen } = setup({ watches: [] });
    await expect
      .element(screen.getByText("Nothing watched yet. ⌘K on a widget → Watch…"))
      .toBeVisible();
  });

  it("shows skeleton rows only once loading takes a moment", async () => {
    const { promise, resolve } = Promise.withResolvers<Watch[]>();
    const { screen } = setup({ listWatches: () => promise });
    expect(
      screen.getByRole("status", { name: "Loading watches" }).query()
    ).toBeNull();
    await expect
      .element(screen.getByRole("status", { name: "Loading watches" }))
      .toBeVisible();
    resolve(watched);
    await expect
      .element(screen.getByRole("listbox", { name: "Watched widgets" }))
      .toBeVisible();
  });

  it("offers a retry when watches can't load", async () => {
    const listWatches = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Disk is full.");
      })
      .mockReturnValue(watched);
    const { screen } = setup({ listWatches });
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Watches couldn’t load.");
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.element(screen.getByText("$48.2k")).toBeVisible();
  });

  it("refreshes when bun says the watches changed", async () => {
    const statuses = [makeStatus({ state: "running" })];
    const { screen } = setup({ statuses, watches: [makeWatch()] });
    await expect.element(screen.getByText("Running…")).toBeVisible();
    await expect
      .element(screen.getByTestId("run-progress"))
      .toBeInTheDocument();
    statuses.splice(0, 1, makeStatus());
    emitIpcMessage("watchesChanged", {});
    await expect.element(screen.getByText(/^Every 5 min/u)).toBeVisible();
  });

  it("lists rows without stagger under reduced motion", async () => {
    reduced.value = true;
    const { screen } = setup();
    await expect.element(screen.getByText("$48.2k")).toBeVisible();
    expect(
      screen.container.querySelector("[data-motion='instant']")
    ).not.toBeNull();
  });
});
