import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Board, BoardDraft } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { makeBoard } from "@/test/board-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import type { RootNavigation } from "./root-view";

import { boardItemId, widgetItemId } from "./root-items";
import { RootView } from "./root-view";

const navigation = (): RootNavigation => ({
  addToBoard: vi.fn(),
  dismiss: vi.fn(),
  editConnection: vi.fn(),
  newBoard: vi.fn(),
  openBoard: vi.fn(),
  openHistory: vi.fn(),
  openSettings: vi.fn(),
  renameBoard: vi.fn(),
  runWidget: vi.fn(),
});

function Harness({ navigate }: { navigate: RootNavigation }) {
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

const ops = makeBoard();
const weekly = makeBoard({ id: "b-weekly", name: "Weekly", tiles: [] });

const setup = async (boards: Board[] = [ops, weekly]) => {
  let stored = [...boards];
  const ipc = {
    deleteBoard: vi.fn((payload: Record<string, unknown>) => {
      stored = stored.filter((board) => board.id !== payload.boardId);
      return null;
    }),
    saveBoard: vi.fn((payload: Record<string, unknown>) => {
      const draft = payload.board as BoardDraft;
      const saved = { ...ops, ...draft, id: draft.id ?? "b-copy" };
      stored = [saved, ...stored.filter((board) => board.id !== saved.id)];
      return saved;
    }),
  };
  mockLauncherIpc({
    connections: [makeConnection({ id: "analytics", name: "analytics" })],
    handlers: {
      ...ipc,
      listBoards: () => stored,
      listWidgets: () => [makeWidget({ id: "w-1", name: "Revenue" })],
    },
  });
  const navigate = navigation();
  const screen = renderWithConnections(<Harness navigate={navigate} />);
  await expect
    .element(screen.getByRole("option", { name: /Ops/ }))
    .toBeVisible();
  const input = screen.getByRole("combobox", { name: "Search commands" });
  await input.click();
  return { input, ipc, navigate, screen };
};

type Screen = Awaited<ReturnType<typeof setup>>["screen"];

const selectRow = async (screen: Screen, id: string) => {
  const input = screen.getByRole("combobox", { name: "Search commands" });
  for (let step = 0; step < 12; step += 1) {
    if (
      input.element().getAttribute("aria-activedescendant") === optionId(id)
    ) {
      return;
    }
    await userEvent.keyboard("{ArrowDown}");
  }
  throw new Error(`row ${id} never became selected`);
};

const openActions = async (screen: Screen) => {
  await userEvent.keyboard("{Meta>}k{/Meta}");
  await expect.element(screen.getByRole("menu")).toHaveFocus();
};

const menuLabels = (screen: Screen) =>
  screen
    .getByRole("menuitem")
    .all()
    .map((item) => item.element().textContent);

describe("root view boards", () => {
  it("lists boards with their tile counts in their own section", async () => {
    const { screen } = await setup();
    const section = screen.getByRole("group", { name: "Boards" });
    await expect.element(section).toHaveTextContent("Ops4 tiles");
    await expect.element(section).toHaveTextContent("Weekly0 tiles");
  });

  it("opens a board with Enter", async () => {
    const { navigate, screen } = await setup();
    await selectRow(screen, boardItemId("b-ops"));
    await expect
      .element(screen.getByText("Open", { exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(navigate.openBoard).toHaveBeenCalledWith("b-ops");
  });

  it("offers board actions and renames through the launcher", async () => {
    const { navigate, screen } = await setup();
    await selectRow(screen, boardItemId("b-ops"));
    await openActions(screen);
    expect(menuLabels(screen)).toStrictEqual([
      "Open",
      "Rename",
      "Duplicate",
      "Delete",
    ]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(navigate.renameBoard).toHaveBeenCalledWith(ops);
  });

  it("duplicates a board under a copy name", async () => {
    const { ipc, screen } = await setup();
    await selectRow(screen, boardItemId("b-ops"));
    await openActions(screen);
    await screen.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect
      .element(screen.getByRole("option", { name: /Ops copy/ }))
      .toBeVisible();
    const draft = ipc.saveBoard.mock.lastCall?.[0]?.board as BoardDraft;
    expect(draft.id).toBeUndefined();
    expect(draft.tiles).toStrictEqual(ops.tiles);
  });

  it("deletes a board only on the second Enter", async () => {
    const { ipc, screen } = await setup();
    await selectRow(screen, boardItemId("b-weekly"));
    await openActions(screen);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await expect
      .element(screen.getByRole("menuitem", { name: /Press ↵ again/ }))
      .toBeVisible();
    expect(ipc.deleteBoard).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => screen.getByRole("option", { name: /Weekly/ }).query())
      .toBeNull();
    expect(ipc.deleteBoard).toHaveBeenCalledWith({ boardId: "b-weekly" });
  });

  it("adds a widget to a board from its actions", async () => {
    const { navigate, screen } = await setup();
    await selectRow(screen, widgetItemId("w-1"));
    await openActions(screen);
    expect(menuLabels(screen)).toStrictEqual(["Run", "Add to Board…"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(navigate.addToBoard).toHaveBeenCalledWith("w-1");
  });

  it("starts a new board from the command", async () => {
    const { input, navigate, screen } = await setup();
    await input.fill("new board");
    await screen.getByRole("option", { name: /New Board/ }).click();
    expect(navigate.newBoard).toHaveBeenCalledOnce();
  });
});
