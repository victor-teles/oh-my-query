import { emptyBoard } from "@conch/rpc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBoardEmulator } from "./browser-board-stub";

const setup = () => {
  let clock = Date.parse("2026-11-19T08:00:00.000Z");
  const onChanged = vi.fn();
  const emulator = createBoardEmulator({
    now: () => {
      clock += 1000;
      return new Date(clock);
    },
    onChanged,
    viewOf: (widgetId) => (widgetId.startsWith("kpi") ? "kpi" : null),
  });
  return { emulator, onChanged };
};

describe("createBoardEmulator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates boards and lists the most recently updated first", () => {
    const { emulator, onChanged } = setup();
    const first = emulator.saveBoard({ board: emptyBoard("First") });
    const second = emulator.saveBoard({ board: emptyBoard("Second") });

    expect(emulator.listBoards().map((board) => board.name)).toStrictEqual([
      "Second",
      "First",
    ]);
    expect(emulator.getBoard({ boardId: first.id })).toStrictEqual(first);
    expect(onChanged.mock.calls).toStrictEqual([[first.id], [second.id]]);
  });

  it("keeps the creation time when a board is saved again", () => {
    const { emulator } = setup();
    const board = emulator.saveBoard({ board: emptyBoard("Ops") });
    const renamed = emulator.saveBoard({
      board: { ...emptyBoard("Ops daily"), id: board.id },
    });
    expect(renamed.createdAt).toBe(board.createdAt);
    expect(renamed.updatedAt > board.updatedAt).toBeTruthy();
    expect(emulator.listBoards()).toHaveLength(1);
  });

  it("adds a tile sized for the widget's view", () => {
    const { emulator } = setup();
    const board = emulator.saveBoard({ board: emptyBoard("Ops") });
    const next = emulator.addBoardTile({
      boardId: board.id,
      widgetId: "kpi-mrr",
    });
    expect(next.tiles).toStrictEqual([
      { id: expect.any(String), size: "s", widgetId: "kpi-mrr" },
    ]);
  });

  it("rejects tiles for missing boards and widgets", () => {
    const { emulator } = setup();
    const board = emulator.saveBoard({ board: emptyBoard("Ops") });
    expect(() =>
      emulator.addBoardTile({ boardId: "gone", widgetId: "kpi-mrr" })
    ).toThrow(expect.objectContaining({ code: "BOARD_NOT_FOUND" }));
    expect(() =>
      emulator.addBoardTile({ boardId: board.id, widgetId: "gone" })
    ).toThrow(expect.objectContaining({ code: "WIDGET_NOT_FOUND" }));
  });

  it("drops a deleted widget's tiles and notifies only the boards it touched", () => {
    const { emulator, onChanged } = setup();
    const ops = emulator.saveBoard({ board: emptyBoard("Ops") });
    const empty = emulator.saveBoard({ board: emptyBoard("Empty") });
    emulator.addBoardTile({ boardId: ops.id, widgetId: "kpi-mrr" });
    onChanged.mockClear();

    emulator.removeWidget("kpi-mrr");
    expect(emulator.getBoard({ boardId: ops.id })?.tiles).toStrictEqual([]);
    expect(onChanged.mock.calls).toStrictEqual([[ops.id]]);
    expect(emulator.getBoard({ boardId: empty.id })).not.toBeNull();
  });

  it("deletes a board", () => {
    const { emulator } = setup();
    const board = emulator.saveBoard({ board: emptyBoard("Ops") });
    emulator.deleteBoard({ boardId: board.id });
    expect(emulator.getBoard({ boardId: board.id })).toBeNull();
  });

  it("ignores corrupt or invalid stored boards", () => {
    const { emulator } = setup();
    localStorage.setItem("conch-boards", "{not json");
    expect(emulator.listBoards()).toStrictEqual([]);
    localStorage.setItem("conch-boards", JSON.stringify([{ id: 1 }]));
    expect(emulator.listBoards()).toStrictEqual([]);
  });
});
