import type { KeyboardEvent } from "react";

import { useCallback } from "react";

import type { CardViewKind } from "@/lib/card-data";

interface UseAskKeyboardOptions {
  busy: boolean;
  views: readonly CardViewKind[];
  onCancel: () => void;
  onCopySql: () => void;
  onToggleSql: () => void;
  onSelectView: (view: CardViewKind) => void;
  onSave: () => void;
  onFindInputs: () => void;
  onToggleActions: () => void;
  onToggleDrill: () => void;
}

const hasTextSelection = (target: EventTarget): boolean => {
  if (target instanceof HTMLInputElement) {
    return target.selectionStart !== target.selectionEnd;
  }
  return (window.getSelection()?.toString() ?? "") !== "";
};

export const useAskKeyboard = ({
  busy,
  views,
  onCancel,
  onCopySql,
  onToggleSql,
  onSelectView,
  onSave,
  onFindInputs,
  onToggleActions,
  onToggleDrill,
}: UseAskKeyboardOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape" && busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (!event.metaKey) {
        return;
      }
      if (event.key === "c" && !hasTextSelection(event.target)) {
        event.preventDefault();
        onCopySql();
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          onFindInputs();
        } else {
          onSave();
        }
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        onToggleActions();
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        onToggleSql();
        return;
      }
      if (event.key === "d") {
        event.preventDefault();
        onToggleDrill();
        return;
      }
      const view = views[Number(event.key) - 1];
      if (view) {
        event.preventDefault();
        onSelectView(view);
      }
    },
    [
      busy,
      onCancel,
      onCopySql,
      onFindInputs,
      onSave,
      onSelectView,
      onToggleActions,
      onToggleDrill,
      onToggleSql,
      views,
    ]
  );
