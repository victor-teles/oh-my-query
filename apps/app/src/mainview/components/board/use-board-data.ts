import { draftOf } from "@conch/rpc";
import { useCallback, useEffect, useState } from "react";

import type { Board } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { getBoard, listWidgets, onBoardChanged, saveBoard } from "@/lib/ipc";

import type { WidgetsById } from "./board-inputs";

export type BoardData =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board; widgets: WidgetsById };

const load = async (boardId: string): Promise<BoardData> => {
  const [board, widgets] = await Promise.all([
    getBoard(boardId),
    listWidgets(),
  ]);
  if (!board) {
    return { status: "missing" };
  }
  return {
    board,
    status: "ready",
    widgets: new Map(widgets.map((widget) => [widget.id, widget])),
  };
};

export const useBoardData = (boardId: string) => {
  const [data, setData] = useState<BoardData>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let next: BoardData;
      try {
        next = await load(boardId);
      } catch (error) {
        next = {
          message: getErrorMessage(error, "This board could not load."),
          status: "error",
        };
      }
      if (!cancelled) {
        setData(next);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [boardId, version]);

  useEffect(
    () =>
      onBoardChanged((changedId) => {
        if (changedId === boardId) {
          setVersion((value) => value + 1);
        }
      }),
    [boardId]
  );

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const update = useCallback(
    async (change: (board: Board) => Board) => {
      if (data.status !== "ready") {
        return;
      }
      const next = change(data.board);
      setData({ ...data, board: next });
      try {
        await saveBoard(draftOf(next));
      } catch (error) {
        console.error("[board] could not save", error);
        reload();
      }
    },
    [data, reload]
  );

  return { data, reload, update };
};
