import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface UseLookupKeyboardOptions {
  searching: boolean;
  move: (delta: number) => void;
  onOpen: () => void;
  onStop: () => void;
  onCopy: () => void;
}

const MOVES: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export const useLookupKeyboard = ({
  searching,
  move,
  onOpen,
  onStop,
  onCopy,
}: UseLookupKeyboardOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape" && searching) {
        event.preventDefault();
        onStop();
        return;
      }
      const delta = MOVES[event.key];
      if (delta) {
        event.preventDefault();
        move(delta);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onOpen();
        return;
      }
      if (event.key === "c" && event.metaKey) {
        event.preventDefault();
        onCopy();
      }
    },
    [move, onCopy, onOpen, onStop, searching]
  );
