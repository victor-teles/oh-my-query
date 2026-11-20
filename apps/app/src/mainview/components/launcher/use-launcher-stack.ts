import { useCallback, useReducer } from "react";

import type { BoardNameTarget } from "@/components/launcher/views/board-name-view";
import type { LookupValue, ParamValues, WidgetDraft } from "@/lib/ipc";

export type LauncherView =
  | { kind: "root" }
  | { kind: "settings" }
  | { kind: "ask" }
  | { kind: "history" }
  | { kind: "lookup"; value: LookupValue; connectionId: string }
  | { kind: "connection-edit"; connectionId: string | null }
  | { kind: "widget-run"; widgetId: string; values: ParamValues }
  | { kind: "widget-inputs"; draft: WidgetDraft; mode: "create" | "edit" }
  | { kind: "board-picker"; widgetId: string }
  | { kind: "board-name"; target: BoardNameTarget };

export type StackDirection = 1 | -1;

export interface LauncherStackState {
  stack: [LauncherView, ...LauncherView[]];
  direction: StackDirection;
}

export type LauncherStackAction =
  | { type: "push"; view: LauncherView }
  | { type: "pop" }
  | { type: "reset" };

export const ROOT_VIEW: LauncherView = { kind: "root" };

export const initialStackState: LauncherStackState = {
  direction: 1,
  stack: [ROOT_VIEW],
};

export const launcherStackReducer = (
  state: LauncherStackState,
  action: LauncherStackAction
): LauncherStackState => {
  switch (action.type) {
    case "push": {
      const top = state.stack.at(-1);
      if (top?.kind === action.view.kind) {
        return state;
      }
      return { direction: 1, stack: [...state.stack, action.view] };
    }
    case "pop": {
      if (state.stack.length === 1) {
        return state;
      }
      const [root, ...rest] = state.stack;
      return { direction: -1, stack: [root, ...rest.slice(0, -1)] };
    }
    case "reset": {
      return state.stack.length === 1
        ? state
        : { direction: -1, stack: [ROOT_VIEW] };
    }
    default: {
      return state;
    }
  }
};

export const useLauncherStack = () => {
  const [state, dispatch] = useReducer(launcherStackReducer, initialStackState);
  const current = state.stack.at(-1) ?? ROOT_VIEW;
  const push = useCallback(
    (view: LauncherView) => dispatch({ type: "push", view }),
    []
  );
  const pop = useCallback(() => dispatch({ type: "pop" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return {
    current,
    depth: state.stack.length,
    direction: state.direction,
    pop,
    push,
    reset,
  };
};
