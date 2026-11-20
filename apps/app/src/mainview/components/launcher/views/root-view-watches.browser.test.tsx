import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Watch, Widget } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { resetPulsedAlerts } from "@/components/watches/alert-row";
import { resetDrawnSparklines } from "@/components/watches/sparkline";
import { resetSeenReveals } from "@/components/widgets/reveal-when-changed";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import {
  firedAlert,
  makeKpiWidget,
  makeTrend,
  makeWatch,
} from "@/test/watch-fixtures";

import { alertItemId, widgetItemId } from "./root-items";
import { RootView } from "./root-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const navigate = {
  addToBoard: vi.fn(),
  dismiss: vi.fn(),
  editConnection: vi.fn(),
  newBoard: vi.fn(),
  openBoard: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
  renameBoard: vi.fn(),
  runWidget: vi.fn(),
  watchWidget: vi.fn(),
};

function Harness() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ width: 760 }}>
      <RootView
        ask={{ reopen: null, start: vi.fn(), startSql: vi.fn() }}
        inputRef={inputRef}
        lookup={{ offer: null, start: vi.fn() }}
        navigate={navigate}
        onQueryChange={setQuery}
        query={query}
      />
    </div>
  );
}

interface SetupOptions {
  watches?: Watch[];
  widgets?: Widget[];
}

const setup = async ({
  watches = [],
  widgets = [makeKpiWidget()],
}: SetupOptions = {}) => {
  const state = { watches };
  const ipc = {
    acknowledgeAlert: vi.fn((payload: Record<string, unknown>) => {
      state.watches = state.watches.map((watch) =>
        watch.id === payload.watchId
          ? {
              ...watch,
              alertState: {
                ...watch.alertState,
                seenAt: new Date().toISOString(),
              },
            }
          : watch
      );
      return null;
    }),
    listWidgetTrends: vi.fn(() => ({ "w-mrr": makeTrend([50_000, 48_200]) })),
    saveWatch: vi.fn((payload: Record<string, unknown>) => {
      const saved = { ...makeWatch(), ...(payload.watch as object) };
      state.watches = [saved];
      return saved;
    }),
  };
  const store = mockLauncherIpc({
    connections: [makeConnection({ id: "analytics" })],
    handlers: {
      ...ipc,
      listWatches: () => state.watches,
      listWidgets: () => widgets,
    },
  });
  store.active = { connectionId: "analytics", database: null };
  const screen = renderWithConnections(<Harness />);
  const search = screen.getByRole("combobox", { name: "Search commands" });
  await expect.element(search).toBeVisible();
  return { ipc, screen, search };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("root view watching with %s", (_label, isReduced) => {
  beforeEach(() => {
    reduced.value = isReduced;
    resetSeenReveals();
    resetPulsedAlerts();
    resetDrawnSparklines();
    vi.clearAllMocks();
  });

  it("lists unseen alerts first and opens the widget on ↵", async () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60_000).toISOString();
    const { ipc, screen, search } = await setup({
      watches: [
        firedAlert({
          alertState: {
            armed: false,
            falseStreak: 0,
            lastFiredAt: fourMinutesAgo,
            seenAt: null,
          },
        }),
      ],
    });
    const alerts = screen.getByRole("group", { name: "Alerts" });
    await expect.element(alerts).toHaveTextContent("MRR below $50k4m ago");
    await expect
      .element(search)
      .toHaveAttribute(
        "aria-activedescendant",
        optionId(alertItemId("watch-mrr"))
      );
    await expect
      .poll(() => alerts.getByTestId("fresh-pulse").query(), { timeout: 3000 })
      .toBeNull();
    expect(alerts.element()).toMatchSnapshot();
    await userEvent.keyboard("{Enter}");
    expect(ipc.acknowledgeAlert).toHaveBeenCalledWith({ watchId: "watch-mrr" });
    expect(navigate.runWidget).toHaveBeenCalledWith("w-mrr", {});
  });

  it("dismisses an alert with ⌫ in an empty input", async () => {
    const { ipc, screen, search } = await setup({ watches: [firedAlert()] });
    await search.click();
    await expect.element(screen.getByText("Dismiss")).toBeVisible();
    await userEvent.keyboard("{Backspace}");
    expect(ipc.acknowledgeAlert).toHaveBeenCalledWith({ watchId: "watch-mrr" });
    expect(navigate.runWidget).not.toHaveBeenCalled();
    emitIpcMessage("watchesChanged", {});
    await expect
      .poll(() => screen.getByRole("group", { name: "Alerts" }).query())
      .toBeNull();
  });

  it("marks watched widgets and shows their trend", async () => {
    const { screen } = await setup({
      watches: [makeWatch({ alert: { kind: "changed" } })],
    });
    const row = screen.getByRole("option", { name: /MRR/u });
    await expect
      .element(row.getByRole("img", { name: "Has an alert" }))
      .toBeVisible();
    await expect
      .element(row.getByRole("img", { name: /^Down 3.6% since/u }))
      .toHaveTextContent("▼ 3.6%");
  });

  it("offers Watch… and the menu bar from ⌘K on a KPI widget", async () => {
    const { ipc, screen, search } = await setup();
    await search.click();
    await expect
      .element(search)
      .toHaveAttribute(
        "aria-activedescendant",
        optionId(widgetItemId("w-mrr"))
      );
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const menu = screen.getByRole("menu");
    await expect.element(menu).toHaveFocus();
    expect(
      menu
        .getByRole("menuitem")
        .all()
        .map((item) => item.element().textContent)
    ).toStrictEqual([
      "Run",
      "Add to Board…",
      "Export Widget",
      "Watch…",
      "Show in Menu Bar",
    ]);
    await screen.getByRole("menuitem", { name: "Show in Menu Bar" }).click();
    expect(ipc.saveWatch).toHaveBeenCalledWith({
      watch: expect.objectContaining({ menuBar: true, widgetId: "w-mrr" }),
    });
    await expect
      .element(screen.getByRole("img", { name: "Shown in the menu bar" }))
      .toBeVisible();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: "Edit Watch…" }).click();
    expect(navigate.watchWidget).toHaveBeenCalledWith("w-mrr");
  });
});
