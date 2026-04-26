import type { RefObject } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";

interface UseGridHotkeysArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  selectAll: () => void;
  moveActive: (direction: 1 | -1, extend: boolean) => void;
  moveActiveColumn: (direction: 1 | -1) => void;
  toggleActiveSelection: () => void;
  openDetailForActive: () => void;
  handleKeyboardCopy: () => void;
}

export const useGridHotkeys = ({
  containerRef,
  selectAll,
  moveActive,
  moveActiveColumn,
  toggleActiveSelection,
  openDetailForActive,
  handleKeyboardCopy,
}: UseGridHotkeysArgs) => {
  useHotkey("Mod+A", selectAll, { target: containerRef });
  useHotkey("ArrowDown", () => moveActive(1, false), { target: containerRef });
  useHotkey("ArrowUp", () => moveActive(-1, false), { target: containerRef });
  useHotkey("ArrowLeft", () => moveActiveColumn(-1), { target: containerRef });
  useHotkey("ArrowRight", () => moveActiveColumn(1), { target: containerRef });
  useHotkey("Shift+ArrowDown", () => moveActive(1, true), {
    target: containerRef,
  });
  useHotkey("Shift+ArrowUp", () => moveActive(-1, true), {
    target: containerRef,
  });
  useHotkey("Space", toggleActiveSelection, { target: containerRef });
  useHotkey("Enter", openDetailForActive, { target: containerRef });
  useHotkey("Mod+C", handleKeyboardCopy, { target: containerRef });
};
