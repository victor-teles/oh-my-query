import { draftOf } from "@oh-my-query/rpc";
import { useCallback, useState } from "react";

import type { Board } from "@/lib/ipc";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { deleteBoard, saveBoard } from "@/lib/ipc";

import type { CatalogAction, CatalogItem } from "./catalog-actions";

export interface CatalogNavigation {
  openBoard: (boardId: string) => void;
  renameBoard: (board: Board) => void;
  runWidget: (widgetId: string) => void;
  addToBoard: (widgetId: string) => void;
}

interface UseCatalogMenuOptions {
  navigate: CatalogNavigation;
  onChanged: () => void;
  onClosed: () => void;
}

const duplicateOf = (board: Board) => {
  const { id: _id, ...draft } = draftOf(board);
  return { ...draft, name: `${board.name} copy`.slice(0, 60) };
};

export const useCatalogMenu = ({
  navigate,
  onChanged,
  onClosed,
}: UseCatalogMenuOptions) => {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const { arm, armed, disarm } = useArmedConfirm();

  const close = useCallback(() => {
    disarm();
    setItem(null);
    onClosed();
  }, [disarm, onClosed]);

  const open = useCallback(
    (next: CatalogItem) => {
      disarm();
      setItem(next);
    },
    [disarm]
  );

  const run = useCallback(
    async (action: CatalogAction) => {
      if (!item) {
        return;
      }
      if (action.id === "delete-board" && !armed) {
        arm();
        return;
      }
      close();
      if (item.kind === "widget") {
        if (action.id === "run-widget") {
          navigate.runWidget(item.widget.id);
        } else if (action.id === "add-to-board") {
          navigate.addToBoard(item.widget.id);
        }
        return;
      }
      switch (action.id) {
        case "open-board": {
          navigate.openBoard(item.board.id);
          break;
        }
        case "rename-board": {
          navigate.renameBoard(item.board);
          break;
        }
        case "duplicate-board": {
          await saveBoard(duplicateOf(item.board));
          onChanged();
          break;
        }
        case "delete-board": {
          await deleteBoard(item.board.id);
          onChanged();
          break;
        }
        default: {
          break;
        }
      }
    },
    [arm, armed, close, item, navigate, onChanged]
  );

  return { armed, close, item, open, run };
};
