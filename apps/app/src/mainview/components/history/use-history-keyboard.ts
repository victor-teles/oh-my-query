import type { KeyboardEvent } from "react";

import type { HistoryCommands } from "./use-history-commands";

const movementFor = (event: KeyboardEvent<HTMLInputElement>): number => {
  if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
    return 1;
  }
  if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
    return -1;
  }
  return 0;
};

const hasTextSelection = (input: HTMLInputElement): boolean =>
  input.selectionStart !== input.selectionEnd;

interface UseHistoryKeyboardOptions {
  commands: HistoryCommands;
  move: (delta: number) => void;
  onToggleMenu: () => void;
}

export const useHistoryKeyboard =
  ({ commands, move, onToggleMenu }: UseHistoryKeyboardOptions) =>
  (event: KeyboardEvent<HTMLInputElement>) => {
    const delta = movementFor(event);
    if (delta !== 0) {
      event.preventDefault();
      move(delta);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commands.askAgain();
      return;
    }
    if (event.metaKey && event.key === "k") {
      event.preventDefault();
      onToggleMenu();
      return;
    }
    if (event.metaKey && event.key === "s") {
      event.preventDefault();
      commands.beginSave();
      return;
    }
    if (event.ctrlKey && event.key === "x") {
      event.preventDefault();
      commands.remove();
      return;
    }
    if (
      event.metaKey &&
      event.key === "c" &&
      !hasTextSelection(event.currentTarget)
    ) {
      event.preventDefault();
      commands.copySql();
    }
  };
