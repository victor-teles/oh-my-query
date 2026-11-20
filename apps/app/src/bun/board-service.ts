import type { createBoardStore } from "@oh-my-query/core";
import type {
  Board as BoardRecord,
  BoardDraft as BoardDraftRecord,
  Widget,
} from "@oh-my-query/rpc";

import { DbError } from "@oh-my-query/core";
import { addTile, Board, BoardDraft, sizeForView } from "@oh-my-query/rpc";
import { z } from "zod";

export type BoardStore = ReturnType<typeof createBoardStore<BoardRecord>>;

export interface BoardServiceDeps {
  boards: BoardStore;
  getWidget(id: string): Promise<Widget | null>;
  now(): Date;
  onChanged(boardId: string): void;
}

const Id = z.string().min(1).max(100);

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const byRecency = (a: BoardRecord, b: BoardRecord): number =>
  b.updatedAt.localeCompare(a.updatedAt);

export const createBoardService = (deps: BoardServiceDeps) => {
  const requireWidget = async (widgetId: string): Promise<Widget> => {
    const widget = await deps.getWidget(widgetId);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const touch = (board: BoardRecord): BoardRecord => ({
    ...board,
    updatedAt: deps.now().toISOString(),
  });

  return {
    async addTile(boardId: string, widgetId: string): Promise<BoardRecord> {
      const widget = await requireWidget(Id.parse(widgetId));
      const updated = await deps.boards.updateBoard(
        Id.parse(boardId),
        (board) =>
          touch(
            addTile(board, {
              id: crypto.randomUUID(),
              size: sizeForView(widget.view),
              widgetId: widget.id,
            })
          )
      );
      if (!updated) {
        throw failure("BOARD_NOT_FOUND", "This board no longer exists.");
      }
      deps.onChanged(updated.id);
      return updated;
    },

    async deleteBoard(boardId: string): Promise<void> {
      await deps.boards.deleteBoard(Id.parse(boardId));
      deps.onChanged(boardId);
    },

    getBoard: (boardId: string) => deps.boards.getBoard(Id.parse(boardId)),

    async listBoards(): Promise<BoardRecord[]> {
      const boards = await deps.boards.listBoards();
      return boards.toSorted(byRecency);
    },

    async removeWidget(widgetId: string): Promise<void> {
      const touched = await deps.boards.removeWidgetTiles(widgetId);
      for (const board of touched) {
        deps.onChanged(board.id);
      }
    },

    async saveBoard(input: BoardDraftRecord): Promise<BoardRecord> {
      const draft = BoardDraft.parse(input);
      const existing = draft.id ? await deps.boards.getBoard(draft.id) : null;
      const stamp = deps.now().toISOString();
      const board = Board.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        id: draft.id ?? crypto.randomUUID(),
        updatedAt: stamp,
      });
      await deps.boards.saveBoard(board);
      deps.onChanged(board.id);
      return board;
    },
  };
};

export type BoardService = ReturnType<typeof createBoardService>;
