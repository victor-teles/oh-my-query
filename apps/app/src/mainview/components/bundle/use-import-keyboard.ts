import type { KeyboardEvent } from "react";

const ROW = "[data-import-row]";
const ROW_FOCUS = "[data-row-focus]";

const rowOf = (target: EventTarget): HTMLElement | null =>
  target instanceof HTMLElement ? target.closest<HTMLElement>(ROW) : null;

const moveRowFocus = (
  container: HTMLElement,
  from: EventTarget,
  delta: 1 | -1
) => {
  const rows = [...container.querySelectorAll<HTMLElement>(ROW)];
  const current = rowOf(from);
  const at = current ? rows.indexOf(current) : -1;
  const next = rows[Math.max(0, Math.min(rows.length - 1, at + delta))];
  const focusTarget = next?.matches(ROW_FOCUS)
    ? next
    : next?.querySelector<HTMLElement>(ROW_FOCUS);
  focusTarget?.focus();
};

interface UseImportKeyboardOptions {
  onImport: () => void;
  onToggleSql: (widgetRef: string) => void;
}

export const useImportKeyboard =
  ({ onImport, onToggleSql }: UseImportKeyboardOptions) =>
  (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveRowFocus(
        event.currentTarget,
        event.target,
        event.key === "ArrowDown" ? 1 : -1
      );
      return;
    }
    if (event.metaKey && event.key === "Enter") {
      event.preventDefault();
      onImport();
      return;
    }
    if (event.metaKey && event.key.toLowerCase() === "e") {
      const widgetRef = rowOf(event.target)?.dataset.widgetRef;
      if (widgetRef) {
        event.preventDefault();
        onToggleSql(widgetRef);
      }
    }
  };
