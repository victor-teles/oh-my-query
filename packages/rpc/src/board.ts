import { z } from "zod";

import type { CardViewKind as CardViewKindValue, ParamDef } from "./widget.ts";

import { CardViewKind, ParamValue } from "./widget.ts";

export const MAX_BOARD_TILES = 24;

export const TILE_SIZES = ["s", "m", "l", "wide"] as const;
export const TileSize = z.enum(TILE_SIZES);
export type TileSize = z.infer<typeof TileSize>;

export const TILE_SPANS: Record<TileSize, number> = {
  l: 6,
  m: 4,
  s: 3,
  wide: 12,
};

export const REFRESH_INTERVALS = ["off", "1m", "5m", "15m", "1h"] as const;
export const RefreshInterval = z.enum(REFRESH_INTERVALS);
export type RefreshInterval = z.infer<typeof RefreshInterval>;

export const REFRESH_MS: Record<RefreshInterval, number | null> = {
  "15m": 900_000,
  "1h": 3_600_000,
  "1m": 60_000,
  "5m": 300_000,
  off: null,
};

export const BoardTile = z.object({
  id: z.string().min(1).max(100),
  size: TileSize,
  view: CardViewKind.optional(),
  widgetId: z.string().min(1).max(100),
});
export type BoardTile = z.infer<typeof BoardTile>;

export const Board = z.object({
  createdAt: z.string(),
  emoji: z.string().max(8).optional(),
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  refresh: RefreshInterval,
  sharedValues: z.record(z.string(), ParamValue),
  tiles: z.array(BoardTile).max(MAX_BOARD_TILES),
  updatedAt: z.string(),
});
export type Board = z.infer<typeof Board>;

export const BoardDraft = Board.omit({
  createdAt: true,
  id: true,
  updatedAt: true,
}).extend({ id: z.string().min(1).max(100).optional() });
export type BoardDraft = z.infer<typeof BoardDraft>;

export const sharedKey = (param: Pick<ParamDef, "name" | "type">): string =>
  `${param.name}:${param.type}`;

export const sizeForView = (view: CardViewKindValue): TileSize => {
  switch (view) {
    case "kpi": {
      return "s";
    }
    case "table": {
      return "l";
    }
    default: {
      return "m";
    }
  }
};

export const emptyBoard = (name: string): BoardDraft => ({
  name,
  refresh: "off",
  sharedValues: {},
  tiles: [],
});

export const draftOf = ({
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  ...draft
}: Board): BoardDraft => draft;

export const addTile = <B extends BoardDraft>(
  board: B,
  tile: BoardTile
): B => ({
  ...board,
  tiles: [...board.tiles, tile].slice(0, MAX_BOARD_TILES),
});

export const removeTile = <B extends BoardDraft>(
  board: B,
  tileId: string
): B => ({
  ...board,
  tiles: board.tiles.filter((tile) => tile.id !== tileId),
});

export const moveTile = <B extends BoardDraft>(
  board: B,
  from: number,
  to: number
): B => {
  const tile = board.tiles[from];
  if (!tile || from === to) {
    return board;
  }
  const target = Math.max(0, Math.min(to, board.tiles.length - 1));
  const tiles = board.tiles.toSpliced(from, 1).toSpliced(target, 0, tile);
  return { ...board, tiles };
};

export const resizeTile = <B extends BoardDraft>(
  board: B,
  tileId: string,
  size: TileSize
): B => ({
  ...board,
  tiles: board.tiles.map((tile) =>
    tile.id === tileId ? { ...tile, size } : tile
  ),
});

export const stepSize = (size: TileSize, step: 1 | -1): TileSize => {
  const index = TILE_SIZES.indexOf(size) + step;
  return (
    TILE_SIZES[Math.max(0, Math.min(index, TILE_SIZES.length - 1))] ?? size
  );
};

export const setTileView = <B extends BoardDraft>(
  board: B,
  tileId: string,
  view: CardViewKindValue
): B => ({
  ...board,
  tiles: board.tiles.map((tile) =>
    tile.id === tileId ? { ...tile, view } : tile
  ),
});

export const setSharedValue = <B extends BoardDraft>(
  board: B,
  key: string,
  value: ParamValue
): B => ({ ...board, sharedValues: { ...board.sharedValues, [key]: value } });
