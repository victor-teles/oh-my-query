import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { optionId } from "@/components/launcher/launcher-row";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { wait } from "@/test/wait";

import { RootView } from "./root-view";

const NO_ASK = { reopen: null, start: vi.fn(), startSql: vi.fn() };

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

function Harness({ onEditConnection }: { onEditConnection: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <RootView
      ask={NO_ASK}
      inputRef={inputRef}
      lookup={{ offer: null, start: vi.fn() }}
      navigate={{
        addToBoard: vi.fn(),
        dismiss: vi.fn(),
        editConnection: onEditConnection,
        newBoard: vi.fn(),
        openBoard: vi.fn(),
        openHistory: vi.fn(),
        openImport: vi.fn(),
        openSettings: vi.fn(),
        renameBoard: vi.fn(),
        runWidget: vi.fn(),
        watchWidget: vi.fn(),
      }}
      onQueryChange={setQuery}
      query={query}
    />
  );
}

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const billing = makeConnection({
  id: "billing",
  lastConnectedAt: "2026-11-10T00:00:00.000Z",
  name: "billing",
});

const setup = async (connections = [analytics]) => {
  const onEditConnection = vi.fn();
  const store = mockLauncherIpc({ connections });
  const screen = renderWithConnections(
    <Harness onEditConnection={onEditConnection} />
  );
  const input = screen.getByRole("combobox", { name: "Search commands" });
  await expect.element(screen.getByRole("option").first()).toBeVisible();
  await input.click();
  return { input, onEditConnection, screen, store };
};

type Screen = Awaited<ReturnType<typeof setup>>["screen"];

const menu = (screen: Screen) => screen.getByRole("menu");

const openActions = async (screen: Screen) => {
  await userEvent.keyboard("{Meta>}k{/Meta}");
  await expect.element(menu(screen)).toHaveFocus();
};

const resetMotion = () => {
  reduced.value = false;
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("connection actions with %s", (_label, isReduced) => {
  beforeEach(() => {
    reduced.value = isReduced;
  });

  it("opens from the selected row and closes back to the input", async () => {
    const { input, screen } = await setup();

    await openActions(screen);
    await expect
      .element(menu(screen))
      .toHaveAccessibleName("Actions for analytics");
    expect(
      screen
        .getByRole("menuitem")
        .all()
        .map((item) => item.element().textContent)
    ).toStrictEqual(["Edit", "Test Connection", "Pin", "Delete"]);
    expect(menu(screen).element()).toMatchSnapshot();

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
    await expect.element(input).toHaveFocus();
  });

  it("deletes only after a second Enter inside the confirm window", async () => {
    const { input, screen, store } = await setup([analytics, billing]);
    await openActions(screen);
    await userEvent.keyboard("{ArrowUp}{Enter}");

    await expect
      .element(
        screen.getByRole("menuitem", { name: /Press ↵ again to delete/ })
      )
      .toBeVisible();
    await expect
      .element(screen.getByTestId("confirm-timer"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("option", { name: /billing/ }))
      .toHaveAttribute("data-tone", "destructive");

    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => screen.getByRole("option", { name: /billing/ }).query())
      .toBeNull();
    expect(store.connections.map((c) => c.id)).toStrictEqual(["analytics"]);
    await expect.element(input).toHaveFocus();
  });
});

describe("connection actions", () => {
  beforeEach(resetMotion);

  it("lets the delete confirmation lapse after three seconds", async () => {
    const { screen, store } = await setup();
    await openActions(screen);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await expect
      .element(screen.getByRole("menuitem", { name: /Press ↵ again/ }))
      .toBeVisible();

    await wait(3100);
    await expect
      .element(screen.getByRole("menuitem", { name: /^Delete$/ }))
      .toBeVisible();
    expect(store.connections).toHaveLength(1);
  });

  it("opens the editor for the row", async () => {
    const { onEditConnection, screen } = await setup();
    await openActions(screen);
    await userEvent.keyboard("{Enter}");
    expect(onEditConnection).toHaveBeenCalledWith("analytics");
  });

  it("tests the connection and reports latency in the row", async () => {
    const { screen } = await setup();
    await openActions(screen);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect.element(screen.getByText("Reachable · 12 ms")).toBeVisible();
  });

  it("pins a connection to the top", async () => {
    const { screen, store } = await setup([billing, analytics]);
    await expect
      .element(screen.getByRole("combobox"))
      .toHaveAttribute("aria-activedescendant", optionId("billing"));
    await userEvent.keyboard("{ArrowDown}");
    await openActions(screen);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await expect
      .element(screen.getByRole("img", { name: "Pinned" }))
      .toBeVisible();
    await expect
      .poll(() => screen.getByRole("option").first().element().id)
      .toBe(optionId("analytics"));
    expect(
      store.connections.find((c) => c.id === "analytics")?.pinned
    ).toBeTruthy();
  });

  it("offers Disconnect for a live connection and clears the chip", async () => {
    const { screen } = await setup();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("img", { name: /Active connection/ }))
      .toBeVisible();

    await openActions(screen);
    await screen.getByRole("menuitem", { name: "Disconnect" }).click();
    await expect
      .poll(() =>
        screen.getByRole("img", { name: /Active connection/ }).query()
      )
      .toBeNull();
  });

  it("ignores Command-K on a command row", async () => {
    const { screen } = await setup([]);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("menu").query()).toBeNull();
  });

  it("closes when focus leaves the menu", async () => {
    const { input, screen } = await setup();
    await openActions(screen);
    await input.click();
    await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
  });
});
