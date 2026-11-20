import { useState } from "react";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";

import type { HistoryAction, HistoryActionId } from "./history-actions";
import type { HistoryCommands } from "./use-history-commands";

interface UseHistoryMenuOptions {
  commands: HistoryCommands;
  canOpen: boolean;
  focusInput: () => void;
}

const commandFor = (
  id: HistoryActionId,
  commands: HistoryCommands
): (() => unknown) => {
  switch (id) {
    case "ask-again": {
      return commands.askAgain;
    }
    case "run-sql": {
      return commands.runSql;
    }
    case "copy-sql": {
      return commands.copySql;
    }
    case "copy-prompt": {
      return commands.copyPrompt;
    }
    case "save-widget": {
      return commands.beginSave;
    }
    case "remove": {
      return commands.remove;
    }
    default: {
      return commands.clear;
    }
  }
};

export const useHistoryMenu = ({
  commands,
  canOpen,
  focusInput,
}: UseHistoryMenuOptions) => {
  const [open, setOpen] = useState(false);
  const { arm, armed, disarm } = useArmedConfirm();

  const close = () => {
    disarm();
    setOpen(false);
    focusInput();
  };

  const toggle = () => {
    if (open) {
      close();
    } else if (canOpen) {
      disarm();
      setOpen(true);
    }
  };

  const run = (action: HistoryAction) => {
    if (action.id === "clear" && !armed) {
      arm();
      return;
    }
    close();
    commandFor(action.id, commands)();
  };

  return { armed, close, open: open && canOpen, run, toggle };
};
