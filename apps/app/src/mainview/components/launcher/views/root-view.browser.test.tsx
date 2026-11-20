import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { ParamValues } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { resetFirstRunReveal } from "./first-run-note";
import { RootView } from "./root-view";

const NO_ASK = { reopen: null, start: vi.fn(), startSql: vi.fn() };

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

interface HarnessProps {
  initialQuery?: string;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onDismiss?: () => void;
  onEditConnection?: (id: string | null) => void;
  onRunWidget?: (widgetId: string, values: ParamValues) => void;
}

function Harness({
  initialQuery = "",
  onOpenSettings = vi.fn(),
  onOpenHistory = vi.fn(),
  onDismiss = vi.fn(),
  onEditConnection = vi.fn(),
  onRunWidget = vi.fn(),
}: HarnessProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <RootView
      ask={NO_ASK}
      inputRef={inputRef}
      lookup={{ offer: null, start: vi.fn() }}
      navigate={{
        addToBoard: vi.fn(),
        dismiss: onDismiss,
        editConnection: onEditConnection,
        newBoard: vi.fn(),
        openBoard: vi.fn(),
        openHistory: onOpenHistory,
        openSettings: onOpenSettings,
        renameBoard: vi.fn(),
        runWidget: onRunWidget,
      }}
      onQueryChange={setQuery}
      query={query}
    />
  );
}

const analytics = makeConnection({
  environment: "prod",
  id: "analytics",
  name: "analytics",
});
const scratch = makeConnection({
  database: "/tmp/scratch.duckdb",
  emoji: "🧪",
  id: "scratch",
  lastConnectedAt: "2026-11-10T00:00:00.000Z",
  name: "scratch",
  type: "duckdb",
});

const renderRoot = (props: HarnessProps = {}) =>
  renderWithConnections(<Harness {...props} />);

type Screen = ReturnType<typeof renderRoot>;

const combobox = (screen: Screen) =>
  screen.getByRole("combobox", { name: "Search commands" });

const option = (screen: Screen, name: RegExp) =>
  screen.getByRole("option", { name });

const resetMotion = () => {
  reduced.value = false;
  resetFirstRunReveal();
};

describe("rootView without connections", () => {
  beforeEach(resetMotion);

  it("leads with a first-run note and Add Connection selected", async () => {
    mockLauncherIpc();
    const screen = renderRoot();

    await expect.element(screen.getByText("No databases yet")).toBeVisible();
    await expect
      .element(combobox(screen))
      .toHaveAttribute("aria-activedescendant", optionId("add-connection"));
    expect(screen.container).toMatchSnapshot();
  });

  it("opens History with ⌘Y and loads only the recents it shows", async () => {
    const listRecentAsks = vi.fn(() => []);
    mockLauncherIpc({ handlers: { listRecentAsks } });
    const onOpenHistory = vi.fn();
    const screen = renderRoot({ onOpenHistory });
    await expect.element(screen.getByText("No databases yet")).toBeVisible();
    expect(listRecentAsks).toHaveBeenCalledWith({ limit: 5 });

    await combobox(screen).click();
    await userEvent.keyboard("{Meta>}y{/Meta}");
    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it("lists Search History among the commands", async () => {
    mockLauncherIpc();
    const onOpenHistory = vi.fn();
    const screen = renderRoot({ initialQuery: "past", onOpenHistory });
    const history = option(screen, /Search History/);
    await expect
      .element(history)
      .toHaveTextContent("Every question you've asked");
    await history.click();
    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it("opens the editor for a new connection", async () => {
    mockLauncherIpc();
    const onEditConnection = vi.fn();
    const screen = renderRoot({ onEditConnection });
    await expect.element(screen.getByText("No databases yet")).toBeVisible();

    await combobox(screen).click();
    await userEvent.keyboard("{Enter}");
    expect(onEditConnection).toHaveBeenCalledWith(null);
  });

  it("offers AI setup when free text matches nothing and no key is set", async () => {
    mockLauncherIpc();
    const onOpenSettings = vi.fn();
    const screen = renderRoot({
      initialQuery: "revenue by month",
      onOpenSettings,
    });

    const setup = option(screen, /Set up an AI provider/);
    await expect.element(setup).toHaveAttribute("aria-selected", "true");
    await combobox(screen).click();
    await userEvent.keyboard("{Enter}");
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("explains an empty result once AI is configured", async () => {
    mockLauncherIpc({
      handlers: {
        getAiSettings: () => ({
          baseUrl: null,
          hasKey: true,
          keyHint: null,
          model: null,
          provider: "anthropic",
        }),
      },
    });
    const screen = renderRoot({ initialQuery: "zzz" });

    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("No matches for “zzz”");
    expect(screen.getByRole("listbox").query()).toBeNull();
  });
});

describe("rootView load states", () => {
  beforeEach(resetMotion);

  it("shows placeholder rows while connections load", async () => {
    const pending = Promise.withResolvers<unknown>();
    mockLauncherIpc({ handlers: { getConnections: () => pending.promise } });
    const screen = renderRoot();

    await expect
      .element(screen.getByRole("status", { name: "Loading connections" }))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
    pending.resolve([]);
  });

  it("reports a load failure and retries", async () => {
    const getConnections = vi
      .fn()
      .mockRejectedValueOnce(new Error("Decryption failed"))
      .mockResolvedValueOnce([analytics]);
    mockLauncherIpc({ handlers: { getConnections: () => getConnections() } });
    const screen = renderRoot();

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Decryption failed");
    expect(screen.container).toMatchSnapshot();

    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.element(option(screen, /analytics/)).toBeVisible();
  });
});

describe("rootView with connections", () => {
  beforeEach(resetMotion);

  it("lists connections first, most recent first, with their details", async () => {
    mockLauncherIpc({ connections: [analytics, scratch] });
    const screen = renderRoot();

    await expect.element(option(screen, /scratch/)).toBeVisible();
    const names = screen
      .getByRole("option")
      .all()
      .map((row) => row.element().id);
    expect(names.slice(0, 2)).toStrictEqual([
      optionId("scratch"),
      optionId("analytics"),
    ]);
    await expect
      .element(screen.getByText("DuckDB · scratch.duckdb"))
      .toBeVisible();
    await expect.element(screen.getByText("prod")).toBeVisible();
    await expect
      .element(screen.getByText("Connect", { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByText("Actions")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("filters connections and commands together", async () => {
    mockLauncherIpc({ connections: [analytics, scratch] });
    const screen = renderRoot();
    await expect.element(option(screen, /scratch/)).toBeVisible();

    await combobox(screen).fill("duck");
    await expect.poll(() => screen.getByRole("option").all().length).toBe(1);
    await expect
      .element(option(screen, /scratch/))
      .toHaveAttribute("aria-selected", "true");
  });

  it("moves the selection with the arrow keys and wraps", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const screen = renderRoot();
    await expect.element(option(screen, /analytics/)).toBeVisible();
    await combobox(screen).click();

    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(combobox(screen))
      .toHaveAttribute("aria-activedescendant", optionId("add-connection"));
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await expect
      .element(combobox(screen))
      .toHaveAttribute("aria-activedescendant", optionId("hide"));
  });

  it("runs commands from the run button", async () => {
    mockLauncherIpc();
    const onDismiss = vi.fn();
    const screen = renderRoot({ onDismiss });
    await expect.element(screen.getByText("No databases yet")).toBeVisible();
    await combobox(screen).click();

    await userEvent.keyboard("{ArrowUp}");
    await screen.getByRole("button", { name: "Run" }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("activating a connection with %s", (_label, isReduced) => {
  beforeEach(resetMotion);

  it("connects, remembers the choice and hands the name to the input chip", async () => {
    reduced.value = isReduced;
    const connect = vi.fn();
    const store = mockLauncherIpc({
      connections: [analytics],
      handlers: { connectToDatabase: (payload) => connect(payload) },
    });
    const screen = renderRoot();
    await expect.element(option(screen, /analytics/)).toBeVisible();
    await combobox(screen).click();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(
        screen.getByRole("img", { name: "Active connection: analytics" })
      )
      .toBeVisible();
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: "analytics" })
    );
    expect(store.active).toStrictEqual({
      connectionId: "analytics",
      database: "analytics",
    });
    await expect
      .element(screen.getByRole("img", { name: "Connected" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Use", { exact: true }))
      .toBeVisible();
    await expect
      .poll(() => screen.getByRole("img", { name: "Connected" }).query(), {
        timeout: 2000,
      })
      .toBeNull();
  });

  it("shows a failed connection in the row without moving the chip", async () => {
    reduced.value = isReduced;
    mockLauncherIpc({
      connections: [analytics],
      handlers: {
        connectToDatabase: vi
          .fn()
          .mockRejectedValue(new Error("password authentication failed")),
      },
    });
    const screen = renderRoot();
    await expect.element(option(screen, /analytics/)).toBeVisible();
    await combobox(screen).click();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByText("password authentication failed"))
      .toBeVisible();
    expect(
      screen.getByRole("img", { name: /Active connection/ }).query()
    ).toBeNull();
    await expect
      .poll(() => screen.getByText("PostgreSQL · localhost/analytics").query())
      .toBeNull();
    expect(screen.container).toMatchSnapshot();
  });
});

describe("restoring the active connection", () => {
  beforeEach(resetMotion);

  it("shows the remembered connection in the chip and footer", async () => {
    mockLauncherIpc({
      connections: [analytics],
      handlers: {
        getActiveConnection: () => ({
          connectionId: "analytics",
          database: "analytics",
        }),
      },
    });
    const screen = renderRoot();

    await expect
      .element(
        screen.getByRole("img", { name: "Active connection: analytics" })
      )
      .toBeVisible();
  });
});
