import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { optionId } from "@/components/launcher/launcher-row";
import { makeBoard } from "@/test/board-fixtures";
import { mockIpc } from "@/test/ipc-mock";

import { BoardPickerView } from "./board-picker-view";

const boards = [
  makeBoard(),
  makeBoard({ id: "b-weekly", name: "Weekly", tiles: [] }),
];

const setup = (addBoardTile: () => unknown = () => boards[0]) => {
  const ipc = {
    addBoardTile: vi.fn(addBoardTile),
    listBoards: () => boards,
    openBoard: vi.fn(() => null),
  };
  mockIpc(ipc);
  const props = { onDone: vi.fn(), onNewBoard: vi.fn() };
  const screen = render(
    <AppProviders>
      <BoardPickerView {...props} widgetId="w-signups" />
    </AppProviders>
  );
  return { ipc, props, screen };
};

describe("boardPickerView", () => {
  it("lists boards and notes the ones that already have the widget", async () => {
    const { screen } = setup();
    await expect
      .element(screen.getByRole("option", { name: /Ops/ }))
      .toHaveTextContent("4 tiles · already has this widget");
    await expect
      .element(screen.getByRole("option", { name: /Weekly/ }))
      .toHaveTextContent("0 tiles");
    await expect
      .element(screen.getByRole("option", { name: /New Board…/ }))
      .toBeVisible();
  });

  it("adds the widget to the chosen board and opens it", async () => {
    const { ipc, props, screen } = setup();
    await expect
      .element(screen.getByRole("option", { name: /Weekly/ }))
      .toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search boards" }))
      .toHaveAttribute("aria-activedescendant", optionId("b-weekly"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => props.onDone.mock.calls.length).toBe(1);
    expect(ipc.addBoardTile).toHaveBeenCalledWith({
      boardId: "b-weekly",
      widgetId: "w-signups",
    });
    expect(ipc.openBoard).toHaveBeenCalledWith({ boardId: "b-weekly" });
  });

  it("filters boards by name and keeps New Board available", async () => {
    const { props, screen } = setup();
    await screen.getByRole("combobox", { name: "Search boards" }).fill("zzz");
    await expect.poll(() => screen.getByRole("option").all().length).toBe(1);
    await userEvent.keyboard("{Enter}");
    expect(props.onNewBoard).toHaveBeenCalledWith("w-signups");
  });

  it("explains a failure without leaving the picker", async () => {
    const { props, screen } = setup(() => {
      throw new Error("This board no longer exists.");
    });
    await screen.getByRole("option", { name: /Ops/ }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("This board no longer exists.");
    expect(props.onDone).not.toHaveBeenCalled();
  });
});
