import { draftOf } from "@conch/rpc";
import { useCallback, useState } from "react";

import type { Board, ExportScope, Widget } from "@/lib/ipc";

import { useMenuBarToggle } from "@/components/watches/use-menu-bar-toggle";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { deleteBoard, saveBoard } from "@/lib/ipc";

import type { CatalogAction, CatalogItem } from "./catalog-actions";

export interface CatalogNavigation {
  openBoard: (boardId: string) => void;
  renameBoard: (board: Board) => void;
  runWidget: (widgetId: string) => void;
  addToBoard: (widgetId: string) => void;
  exportScope: (scope: ExportScope) => void;
  watchWidget: (widgetId: string) => void;
}

interface UseCatalogMenuOptions {
  navigate: CatalogNavigation;
  onChanged: () => void;
  onClosed: () => void;
}

const runWidgetAction = async (
  action: CatalogAction,
  widget: Widget,
  navigate: CatalogNavigation,
  toggleMenuBar: (widget: Widget) => Promise<boolean>
) => {
  switch (action.id) {
    case "run-widget": {
      navigate.runWidget(widget.id);
      break;
    }
    case "add-to-board": {
      navigate.addToBoard(widget.id);
      break;
    }
    case "watch": {
      navigate.watchWidget(widget.id);
      break;
    }
    case "export-widget": {
      navigate.exportScope({ kind: "widget", widgetId: widget.id });
      break;
    }
    case "menu-bar": {
      await toggleMenuBar(widget);
      break;
    }
    default: {
      break;
    }
  }
};

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
  const toggleMenuBar = useMenuBarToggle();

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
        await runWidgetAction(action, item.widget, navigate, toggleMenuBar);
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
        case "export-board": {
          navigate.exportScope({ boardId: item.board.id, kind: "board" });
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
    [arm, armed, close, item, navigate, onChanged, toggleMenuBar]
  );

  return { armed, close, item, open, run };
};
