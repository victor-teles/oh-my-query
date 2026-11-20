import { describe, expect, it } from "vitest";

import type { BoardDraft, BoardTile } from "./board.ts";

import {
  addTile,
  Board,
  emptyBoard,
  MAX_BOARD_TILES,
  moveTile,
  removeTile,
  resizeTile,
  setSharedValue,
  setTileView,
  sharedKey,
  sizeForView,
  stepSize,
} from "./board.ts";

const tile = (id: string): BoardTile => ({
  id,
  size: "m",
  widgetId: `w-${id}`,
});

const board = (...ids: string[]): BoardDraft => ({
  ...emptyBoard("Ops"),
  tiles: ids.map(tile),
});

const order = (draft: BoardDraft) => draft.tiles.map((item) => item.id);

describe("board operations", () => {
  it("adds tiles at the end and caps the count", () => {
    expect(order(addTile(board("a"), tile("b")))).toStrictEqual(["a", "b"]);
    const full = board(
      ...Array.from({ length: MAX_BOARD_TILES }, (_, i) => `t${i}`)
    );
    expect(addTile(full, tile("x")).tiles).toHaveLength(MAX_BOARD_TILES);
  });

  it("removes a tile", () => {
    expect(order(removeTile(board("a", "b", "c"), "b"))).toStrictEqual([
      "a",
      "c",
    ]);
  });

  it("moves tiles, clamping at the edges", () => {
    expect(order(moveTile(board("a", "b", "c"), 0, 2))).toStrictEqual([
      "b",
      "c",
      "a",
    ]);
    expect(order(moveTile(board("a", "b", "c"), 2, 0))).toStrictEqual([
      "c",
      "a",
      "b",
    ]);
    expect(order(moveTile(board("a", "b", "c"), 1, 99))).toStrictEqual([
      "a",
      "c",
      "b",
    ]);
    expect(order(moveTile(board("a", "b", "c"), 1, -4))).toStrictEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("returns the same board when a move changes nothing", () => {
    const same = board("a", "b");
    expect(moveTile(same, 1, 1)).toBe(same);
    expect(moveTile(same, 7, 0)).toBe(same);
  });

  it("resizes and steps sizes within bounds", () => {
    expect(resizeTile(board("a"), "a", "wide").tiles[0]?.size).toBe("wide");
    expect(stepSize("s", -1)).toBe("s");
    expect(stepSize("s", 1)).toBe("m");
    expect(stepSize("wide", 1)).toBe("wide");
  });

  it("stores a view override and shared values", () => {
    expect(setTileView(board("a"), "a", "table").tiles[0]?.view).toBe("table");
    expect(
      setSharedValue(board(), "period:dateRange", "ytd").sharedValues
    ).toStrictEqual({ "period:dateRange": "ytd" });
  });

  it("keys shared inputs by name and type", () => {
    expect(sharedKey({ name: "period", type: "dateRange" })).toBe(
      "period:dateRange"
    );
  });

  it("sizes a new tile from its view", () => {
    expect(sizeForView("kpi")).toBe("s");
    expect(sizeForView("line")).toBe("m");
    expect(sizeForView("table")).toBe("l");
  });

  it("validates a board", () => {
    const valid = {
      ...board("a"),
      createdAt: "2026-11-19T00:00:00.000Z",
      id: "b1",
      updatedAt: "2026-11-19T00:00:00.000Z",
    };
    expect(Board.safeParse(valid).success).toBeTruthy();
    expect(Board.safeParse({ ...valid, name: " " }).success).toBeFalsy();
    expect(Board.safeParse({ ...valid, refresh: "2m" }).success).toBeFalsy();
  });
});
