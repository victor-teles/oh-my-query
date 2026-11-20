import type { KeyboardEvent } from "react";

import { editableParams } from "@oh-my-query/rpc";
import { useCallback } from "react";

import type { InputMode } from "@/components/launcher/input-mode";
import type { FooterHint } from "@/components/launcher/launcher-footer";
import type { RootAlert } from "@/components/watches/use-alerts";

import type { RootItem } from "./root-items";

const ACTIONS_HINT: FooterHint = { keys: ["⌘", "K"], label: "Actions" };
const INPUTS_HINT: FooterHint = { keys: ["⇥"], label: "Inputs" };
const COLUMNS_HINT: FooterHint = { keys: ["⌘", "↓"], label: "Columns" };
const DISMISS_HINT: FooterHint = { keys: ["⌫"], label: "Dismiss" };
export const LAST_ANSWER_HINT: FooterHint = {
  keys: ["↑"],
  label: "Last answer",
};

const movementFor = (event: KeyboardEvent<HTMLInputElement>): number => {
  if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
    return 1;
  }
  if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
    return -1;
  }
  return 0;
};

export interface ModeKeys {
  commit: ((item: RootItem) => void) | null;
  focusDetail: (() => void) | null;
}

interface UseRootKeyboardOptions {
  selected: RootItem | null;
  move: (delta: number) => void;
  onRun: (item: RootItem | null) => void;
  onOpenActions: (item: RootItem) => void;
  onOpenInputs: (widgetId: string) => void;
  onReopen: (() => void) | null;
  onOpenHistory: () => void;
  onDismissAlert: (alert: RootAlert) => void;
  modeKeys: ModeKeys;
}

const hasInputs = (
  item: RootItem | null
): item is RootItem & {
  kind: "widget";
} => item?.kind === "widget" && editableParams(item.widget.params).length > 0;

// Only an empty input dismisses, and holding ⌫ to clear text never does.
const dismissibleAlert = (
  event: KeyboardEvent<HTMLInputElement>,
  selected: RootItem | null
): RootAlert | null =>
  event.key === "Backspace" &&
  !event.repeat &&
  event.currentTarget.value === "" &&
  selected?.kind === "alert"
    ? selected.alert
    : null;

const runMetaShortcut = (
  event: KeyboardEvent<HTMLInputElement>,
  openHistory: () => void,
  openActions: () => void
): void => {
  if (!event.metaKey || (event.key !== "y" && event.key !== "k")) {
    return;
  }
  event.preventDefault();
  if (event.key === "y") {
    openHistory();
  } else {
    openActions();
  }
};

export const useRootKeyboard = ({
  selected,
  move,
  onRun,
  onOpenActions,
  onOpenInputs,
  onReopen,
  onOpenHistory,
  onDismissAlert,
  modeKeys,
}: UseRootKeyboardOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const { commit, focusDetail } = modeKeys;
      const alert = dismissibleAlert(event, selected);
      if (alert) {
        event.preventDefault();
        onDismissAlert(alert);
        return;
      }
      if (event.key === "ArrowDown" && event.metaKey && focusDetail) {
        event.preventDefault();
        focusDetail();
        return;
      }
      if (event.key === "Tab" && !event.shiftKey && commit && selected) {
        event.preventDefault();
        commit(selected);
        return;
      }
      if (event.key === "ArrowUp" && onReopen) {
        event.preventDefault();
        onReopen();
        return;
      }
      const delta = movementFor(event);
      if (delta !== 0) {
        event.preventDefault();
        move(delta);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onRun(selected);
        return;
      }
      if (event.key === "Tab" && !event.shiftKey && hasInputs(selected)) {
        event.preventDefault();
        onOpenInputs(selected.widget.id);
        return;
      }
      runMetaShortcut(
        event,
        () => onOpenHistory(),
        () => {
          if (selected) {
            onOpenActions(selected);
          }
        }
      );
    },
    [
      modeKeys,
      move,
      onDismissAlert,
      onOpenActions,
      onOpenHistory,
      onOpenInputs,
      onReopen,
      onRun,
      selected,
    ]
  );

interface RootFooter {
  actionLabel: string | null;
  hints: FooterHint[];
}

export const footerFor = (
  selected: RootItem | null,
  liveIds: readonly string[],
  mode: InputMode = "search"
): RootFooter => {
  if (!selected) {
    return { actionLabel: null, hints: [] };
  }
  if (selected.kind === "sql") {
    return { actionLabel: "Run", hints: [] };
  }
  if (selected.kind === "lookup") {
    return { actionLabel: "Find", hints: [] };
  }
  if (selected.kind === "table") {
    return { actionLabel: "Preview rows", hints: [COLUMNS_HINT] };
  }
  if (selected.kind === "connection" && mode === "connection") {
    return { actionLabel: "Switch", hints: [] };
  }
  if (selected.kind === "ask") {
    return { actionLabel: "Ask", hints: [] };
  }
  if (selected.kind === "recent") {
    return { actionLabel: "Ask again", hints: [] };
  }
  if (selected.kind === "board") {
    return { actionLabel: "Open", hints: [ACTIONS_HINT] };
  }
  if (selected.kind === "alert") {
    return { actionLabel: "Open", hints: [DISMISS_HINT] };
  }
  if (selected.kind === "widget") {
    return {
      actionLabel: "Run",
      hints: hasInputs(selected) ? [INPUTS_HINT, ACTIONS_HINT] : [ACTIONS_HINT],
    };
  }
  if (selected.kind === "command") {
    return { actionLabel: selected.command.actionLabel, hints: [] };
  }
  const live = liveIds.includes(selected.id);
  return { actionLabel: live ? "Use" : "Connect", hints: [ACTIONS_HINT] };
};
