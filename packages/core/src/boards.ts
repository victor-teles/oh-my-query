import type { Identified, RecordParser } from "./records.ts";

import { boardsPath } from "./paths.ts";
import { createRecordStore } from "./records.ts";

interface TiledRecord extends Identified {
  tiles: readonly { widgetId: string }[];
}

export const createBoardStore = <T extends TiledRecord>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(boardsPath, parse);
  return {
    deleteBoard: store.remove,
    getBoard: store.get,
    listBoards: store.list,
    removeWidgetTiles: (widgetId: string): Promise<T[]> =>
      store.updateWhere(
        (board) => board.tiles.some((tile) => tile.widgetId === widgetId),
        (board) => ({
          ...board,
          tiles: board.tiles.filter((tile) => tile.widgetId !== widgetId),
        })
      ),
    saveBoard: store.save,
    updateBoard: store.update,
  };
};
