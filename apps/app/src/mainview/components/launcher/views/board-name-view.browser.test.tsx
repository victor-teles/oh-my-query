import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { BoardDraft } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { makeBoard } from "@/test/board-fixtures";
import { mockIpc } from "@/test/ipc-mock";

import type { BoardNameTarget } from "./board-name-view";

import { BoardNameView } from "./board-name-view";

const CREATE: BoardNameTarget = {
  addWidgetId: "w-1",
  boardId: null,
  initialName: "",
};

const setup = (target: BoardNameTarget, saveBoard?: () => never) => {
  const ipc = {
    addBoardTile: vi.fn(() => makeBoard()),
    getBoard: vi.fn(() => makeBoard()),
    openBoard: vi.fn(() => null),
    saveBoard: vi.fn(
      saveBoard ??
        ((payload: Record<string, unknown>) => ({
          ...makeBoard({ id: "b-new" }),
          ...(payload.board as BoardDraft),
        }))
    ),
  };
  mockIpc(ipc);
  const onDone = vi.fn();
  const screen = render(
    <AppProviders>
      <BoardNameView onBack={vi.fn()} onDone={onDone} target={target} />
    </AppProviders>
  );
  return {
    input: screen.getByRole("textbox", { name: "Board name" }),
    ipc,
    onDone,
    screen,
  };
};

const savedDraft = (ipc: ReturnType<typeof setup>["ipc"]) =>
  (ipc.saveBoard.mock.lastCall?.[0] as { board: BoardDraft } | undefined)
    ?.board;

describe("boardNameView", () => {
  it("creates the board, adds the widget and opens it", async () => {
    const { input, ipc, onDone, screen } = setup(CREATE);
    await expect.element(screen.getByText("New Board")).toBeVisible();
    await expect.element(input).toHaveFocus();
    await input.fill("Morning metrics");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => onDone.mock.calls.length).toBe(1);
    expect(savedDraft(ipc)?.name).toBe("Morning metrics");
    expect(ipc.addBoardTile).toHaveBeenCalledWith({
      boardId: "b-new",
      widgetId: "w-1",
    });
    expect(ipc.openBoard).toHaveBeenCalledWith({ boardId: "b-new" });
  });

  it("asks for a name before saving", async () => {
    const { ipc, screen } = setup(CREATE);
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Give the board a name.");
    expect(ipc.saveBoard).not.toHaveBeenCalled();
  });

  it("renames an existing board without opening it", async () => {
    const { input, ipc, onDone, screen } = setup({
      addWidgetId: null,
      boardId: "b-ops",
      initialName: "Ops",
    });
    await expect.element(screen.getByText("Rename Board")).toBeVisible();
    await expect.element(input).toHaveValue("Ops");
    await input.fill("Ops daily");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => onDone.mock.calls.length).toBe(1);
    expect(savedDraft(ipc)).toMatchObject({ id: "b-ops", name: "Ops daily" });
    expect(ipc.openBoard).not.toHaveBeenCalled();
  });

  it("shows why the board could not be saved", async () => {
    const { input, onDone, screen } = setup(CREATE, () => {
      throw new Error("disk full");
    });
    await input.fill("Ops");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("disk full");
    expect(onDone).not.toHaveBeenCalled();
  });
});
