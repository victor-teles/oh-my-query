import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface UseWatchHotkeysOptions {
  onSave: () => void;
  onStop: (() => void) | null;
}

export const useWatchHotkeys = ({ onSave, onStop }: UseWatchHotkeysOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!event.metaKey) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onSave();
      } else if (event.key === "Backspace" && onStop) {
        event.preventDefault();
        onStop();
      }
    },
    [onSave, onStop]
  );
