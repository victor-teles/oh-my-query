import { useCallback, useMemo, useRef, useState } from "react";

import type { ResultAction } from "@/components/result-actions/result-actions";
import type { AskSave } from "@/components/widgets/use-ask-save";

import { askResultActions } from "@/components/result-actions/result-actions";
import {
  runExportAction,
  useResultExport,
} from "@/components/result-actions/use-result-export";

import type { AskState } from "./ask-reducer";

import { exportSourceOf } from "./ask-answer";
import { isWorking, shownTurn } from "./ask-reducer";

export const ASK_ACTIONS_ANCHOR_ID = "ask-card-actions";

const menuHasFocus = (): boolean =>
  Boolean(document.activeElement?.closest('[role="menu"]'));

interface UseAskActionsMenuOptions {
  state: AskState;
  saving: AskSave;
  canSave: boolean;
  copySql: () => void;
  focusInput: () => void;
  onAddToBoard: (widgetId: string) => void;
}

export const useAskActionsMenu = ({
  state,
  saving,
  canSave,
  copySql,
  focusInput,
  onAddToBoard,
}: UseAskActionsMenuOptions) => {
  const cardRef = useRef<HTMLElement>(null);
  const turn = shownTurn(state);
  const source = useMemo(() => exportSourceOf(turn), [turn]);
  const exporter = useResultExport({ cardRef, source });
  const [open, setOpen] = useState(false);
  const available = !isWorking(state.status) && state.sql !== "";

  const actions = askResultActions({
    canSave,
    hasRows: (source?.result.rows.length ?? 0) > 0,
    hasSql: state.sql !== "",
    view: source?.view ?? null,
  });

  const close = useCallback(() => {
    const returnFocus = menuHasFocus();
    setOpen(false);
    if (returnFocus) {
      focusInput();
    }
  }, [focusInput]);

  const toggle = useCallback(() => {
    if (open) {
      close();
    } else if (available) {
      setOpen(true);
    }
  }, [available, close, open]);

  const { beginNaming, phase } = saving;
  const run = useCallback(
    async (action: ResultAction) => {
      setOpen(false);
      focusInput();
      switch (action.id) {
        case "save-widget": {
          beginNaming("save");
          return;
        }
        case "add-to-board": {
          if (phase.kind === "saved") {
            onAddToBoard(phase.widget.id);
          } else {
            beginNaming("board");
          }
          return;
        }
        default: {
          await runExportAction(action.id, exporter, copySql);
        }
      }
    },
    [beginNaming, copySql, exporter, focusInput, onAddToBoard, phase]
  );

  return {
    actions,
    cardRef,
    close,
    exporter,
    open: open && available,
    run,
    toggle,
  };
};

export type AskActionsMenu = ReturnType<typeof useAskActionsMenu>;
