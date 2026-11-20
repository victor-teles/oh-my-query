import type {
  Board as BoardRecord,
  BoardDraft as BoardDraftRecord,
} from "@conch/rpc";

import { addTile, Board, BoardDraft, sizeForView } from "@conch/rpc";

const BOARDS_KEY = "conch-boards";

const readBoards = (): BoardRecord[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(BOARDS_KEY) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed.flatMap((raw) => {
          const board = Board.safeParse(raw);
          return board.success ? [board.data] : [];
        })
      : [];
  } catch {
    return [];
  }
};

const writeBoards = (boards: BoardRecord[]) =>
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code, name: "DbError" });

interface BoardEmulatorDeps {
  now: () => Date;
  viewOf: (widgetId: string) => BoardRecord["tiles"][number]["view"] | null;
  onChanged: (boardId: string) => void;
}

export const createBoardEmulator = ({
  now,
  viewOf,
  onChanged,
}: BoardEmulatorDeps) => {
  const touch = (board: BoardRecord): BoardRecord => ({
    ...board,
    updatedAt: now().toISOString(),
  });

  return {
    addBoardTile: ({
      boardId,
      widgetId,
    }: {
      boardId: string;
      widgetId: string;
    }) => {
      const boards = readBoards();
      const board = boards.find((item) => item.id === boardId);
      const view = viewOf(widgetId);
      if (!board) {
        throw failure("BOARD_NOT_FOUND", "This board no longer exists.");
      }
      if (!view) {
        throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
      }
      const next = touch(
        addTile(board, {
          id: crypto.randomUUID(),
          size: sizeForView(view),
          widgetId,
        })
      );
      writeBoards(boards.map((item) => (item.id === boardId ? next : item)));
      onChanged(boardId);
      return next;
    },
    deleteBoard: ({ boardId }: { boardId: string }) => {
      writeBoards(readBoards().filter((board) => board.id !== boardId));
      onChanged(boardId);
    },
    getBoard: ({ boardId }: { boardId: string }) =>
      readBoards().find((board) => board.id === boardId) ?? null,
    listBoards: () =>
      readBoards().toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    removeWidget: (widgetId: string) => {
      const boards = readBoards();
      writeBoards(
        boards.map((board) => ({
          ...board,
          tiles: board.tiles.filter((tile) => tile.widgetId !== widgetId),
        }))
      );
      for (const board of boards) {
        if (board.tiles.some((tile) => tile.widgetId === widgetId)) {
          onChanged(board.id);
        }
      }
    },
    saveBoard: ({ board: input }: { board: BoardDraftRecord }) => {
      const draft = BoardDraft.parse(input);
      const boards = readBoards();
      const existing = boards.find((board) => board.id === draft.id);
      const stamp = now().toISOString();
      const board = Board.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        id: draft.id ?? crypto.randomUUID(),
        updatedAt: stamp,
      });
      writeBoards([...boards.filter((item) => item.id !== board.id), board]);
      onChanged(board.id);
      return board;
    },
  };
};
