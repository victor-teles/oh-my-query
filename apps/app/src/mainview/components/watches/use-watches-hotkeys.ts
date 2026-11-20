import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface UseWatchesHotkeysOptions {
  move: (delta: number) => void;
  onOpen: () => void;
  onRemove: () => void;
}

export const useWatchesHotkeys = ({
  move,
  onOpen,
  onRemove,
}: UseWatchesHotkeysOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
          break;
        }
        case "Enter": {
          event.preventDefault();
          onOpen();
          break;
        }
        case "Backspace":
        case "Delete": {
          event.preventDefault();
          onRemove();
          break;
        }
        default: {
          break;
        }
      }
    },
    [move, onOpen, onRemove]
  );
