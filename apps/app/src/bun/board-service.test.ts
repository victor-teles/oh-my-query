import type { Board, Widget } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { BoardStore } from "./board-service.ts";

import { createBoardService } from "./board-service.ts";

const NOW = new Date("2026-11-19T10:00:00.000Z");

const widget = (id: string, view: Widget["view"]): Widget => ({
  connectionId: "c1",
  createdAt: NOW.toISOString(),
  database: null,
  dialect: "postgresql",
  id,
  lastRunAt: null,
  lastValues: {},
  name: id,
  params: [],
  prompt: "",
  spec: {
    formats: {},
    title: id,
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  sqlTemplate: "select 1",
  updatedAt: NOW.toISOString(),
  view,
});

const memoryBoards = (initial: Board[] = []): BoardStore => {
  let items = [...initial];
  const update = (id: string, change: (board: Board) => Board) => {
    const current = items.find((board) => board.id === id);
    if (!current) {
      return Promise.resolve(null);
    }
    const next = change(current);
    items = items.map((board) => (board.id === id ? next : board));
    return Promise.resolve(next);
  };
  return {
    deleteBoard: (id) => {
      items = items.filter((board) => board.id !== id);
      return Promise.resolve();
    },
    getBoard: (id) => {
      const found = items.find((board) => board.id === id) ?? null;
      return Promise.resolve(found);
    },
    listBoards: () => {
      const all = [...items];
      return Promise.resolve(all);
    },
    removeWidgetTiles: (widgetId) => {
      const touched = items.filter((board) =>
        board.tiles.some((tile) => tile.widgetId === widgetId)
      );
      items = items.map((board) => ({
        ...board,
        tiles: board.tiles.filter((tile) => tile.widgetId !== widgetId),
      }));
      return Promise.resolve(touched);
    },
    saveBoard: (board) => {
      items = [...items.filter((item) => item.id !== board.id), board];
      return Promise.resolve(board);
    },
    updateBoard: update,
  };
};

const setup = (boards: Board[] = []) => {
  const onChanged = vi.fn();
  const widgets = new Map(
    [
      widget("w-kpi", "kpi"),
      widget("w-line", "line"),
      widget("w-table", "table"),
    ].map((w) => [w.id, w])
  );
  const service = createBoardService({
    boards: memoryBoards(boards),
    getWidget: (id) => {
      const found = widgets.get(id) ?? null;
      return Promise.resolve(found);
    },
    now: () => NOW,
    onChanged,
  });
  return { onChanged, service };
};

const draft = {
  name: "Ops",
  refresh: "off" as const,
  sharedValues: {},
  tiles: [],
};

describe("createBoardService", () => {
  it("creates a board with timestamps and announces it", async () => {
    const { onChanged, service } = setup();
    const board = await service.saveBoard(draft);
    expect(board).toMatchObject({
      createdAt: NOW.toISOString(),
      name: "Ops",
      updatedAt: NOW.toISOString(),
    });
    expect(onChanged).toHaveBeenCalledWith(board.id);
    await expect(service.listBoards()).resolves.toHaveLength(1);
  });

  it("keeps createdAt when a board is saved again", async () => {
    const { service } = setup([
      {
        ...draft,
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "b1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const saved = await service.saveBoard({
      ...draft,
      id: "b1",
      name: "Renamed",
    });
    expect(saved).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "Renamed",
    });
  });

  it("refuses an invalid board", async () => {
    const { service } = setup();
    await expect(
      service.saveBoard({ ...draft, name: "  " })
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("adds a tile sized from the widget's view", async () => {
    const { onChanged, service } = setup([
      { ...draft, createdAt: "", id: "b1", updatedAt: "" },
    ]);
    await service.addTile("b1", "w-kpi");
    await service.addTile("b1", "w-line");
    const board = await service.addTile("b1", "w-table");
    expect(board.tiles.map((tile) => [tile.widgetId, tile.size])).toStrictEqual(
      [
        ["w-kpi", "s"],
        ["w-line", "m"],
        ["w-table", "l"],
      ]
    );
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it("reports a missing board or widget", async () => {
    const { service } = setup([
      { ...draft, createdAt: "", id: "b1", updatedAt: "" },
    ]);
    await expect(service.addTile("nope", "w-kpi")).rejects.toMatchObject({
      code: "BOARD_NOT_FOUND",
    });
    await expect(service.addTile("b1", "gone")).rejects.toMatchObject({
      code: "WIDGET_NOT_FOUND",
    });
  });

  it("drops a deleted widget's tiles and announces each touched board", async () => {
    const tiles = [{ id: "t1", size: "m" as const, widgetId: "w-line" }];
    const { onChanged, service } = setup([
      { ...draft, createdAt: "", id: "b1", tiles, updatedAt: "" },
      { ...draft, createdAt: "", id: "b2", updatedAt: "" },
    ]);
    await service.removeWidget("w-line");
    expect(onChanged.mock.calls).toStrictEqual([["b1"]]);
    const board = await service.getBoard("b1");
    expect(board?.tiles).toStrictEqual([]);
  });

  it("deletes a board", async () => {
    const { onChanged, service } = setup([
      { ...draft, createdAt: "", id: "b1", updatedAt: "" },
    ]);
    await service.deleteBoard("b1");
    await expect(service.getBoard("b1")).resolves.toBeNull();
    expect(onChanged).toHaveBeenCalledWith("b1");
  });

  it("lists the most recently changed board first", async () => {
    const { service } = setup([
      {
        ...draft,
        createdAt: "",
        id: "old",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        ...draft,
        createdAt: "",
        id: "new",
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    const boards = await service.listBoards();
    expect(boards.map((board) => board.id)).toStrictEqual(["new", "old"]);
  });
});
