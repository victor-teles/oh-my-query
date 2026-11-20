import { useCallback, useState } from "react";

import type { ResultExport } from "@/components/result-actions/use-result-export";
import type { Widget, WidgetDraft, WidgetRunResult } from "@/lib/ipc";

import { runExportAction } from "@/components/result-actions/use-result-export";
import { useMenuBarToggle } from "@/components/watches/use-menu-bar-toggle";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { copyText } from "@/lib/clipboard";

import type { WidgetAction } from "./widget-actions";

import { draftFromWidget, duplicateDraft } from "./widget-draft";
import { useWidgets } from "./widgets-provider";

interface UseWidgetMenuOptions {
  widget: Widget;
  outcome: WidgetRunResult | null;
  exporter: ResultExport;
  onRename: () => void;
  onEditInputs: (draft: WidgetDraft) => void;
  onAddToBoard: (widgetId: string) => void;
  onWatch: (widgetId: string) => void;
  onDeleted: () => void;
}

export const useWidgetMenu = ({
  widget,
  outcome,
  exporter,
  onRename,
  onEditInputs,
  onAddToBoard,
  onWatch,
  onDeleted,
}: UseWidgetMenuOptions) => {
  const { save, remove } = useWidgets();
  const toggleMenuBar = useMenuBarToggle();
  const [open, setOpen] = useState(false);
  const { arm, armed, disarm } = useArmedConfirm();
  const { announce } = exporter;

  const close = useCallback(() => {
    disarm();
    setOpen(false);
  }, [disarm]);

  const toggle = useCallback(() => {
    disarm();
    setOpen((value) => !value);
  }, [disarm]);

  const copySql = useCallback(async () => {
    const sql = outcome?.compiledSql ?? widget.sqlTemplate;
    if (await copyText(sql)) {
      announce("Copied SQL");
    }
  }, [announce, outcome, widget.sqlTemplate]);

  const run = useCallback(
    async (action: WidgetAction) => {
      if (action.id === "delete" && !armed) {
        arm();
        return;
      }
      close();
      switch (action.id) {
        case "edit-inputs": {
          onEditInputs(draftFromWidget(widget));
          break;
        }
        case "add-to-board": {
          onAddToBoard(widget.id);
          break;
        }
        case "watch": {
          onWatch(widget.id);
          break;
        }
        case "menu-bar": {
          const pinned = await toggleMenuBar(widget);
          announce(pinned ? "In the menu bar" : "Removed from the menu bar");
          break;
        }
        case "rename": {
          onRename();
          break;
        }
        case "duplicate": {
          await save(duplicateDraft(widget));
          announce("Duplicated");
          break;
        }
        case "delete": {
          await remove(widget.id);
          onDeleted();
          break;
        }
        default: {
          await runExportAction(action.id, exporter, copySql);
        }
      }
    },
    [
      announce,
      arm,
      armed,
      close,
      copySql,
      exporter,
      onAddToBoard,
      onDeleted,
      onEditInputs,
      onRename,
      onWatch,
      remove,
      save,
      toggleMenuBar,
      widget,
    ]
  );

  return { armed, close, copySql, open, run, toggle };
};
