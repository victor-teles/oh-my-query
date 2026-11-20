import type {
  WidgetRunAction,
  WidgetRunState,
} from "@/components/widgets/widget-run-reducer";

import {
  initialWidgetRun,
  widgetRunReducer,
} from "@/components/widgets/widget-run-reducer";

export type BoardRuns = Readonly<Record<string, WidgetRunState>>;

export type BoardRunsAction =
  | { type: "tile"; tileId: string; action: WidgetRunAction }
  | { type: "prune"; keep: readonly string[] };

export const boardRunsReducer = (
  state: BoardRuns,
  action: BoardRunsAction
): BoardRuns => {
  if (action.type === "prune") {
    const kept = Object.entries(state).filter(([id]) =>
      action.keep.includes(id)
    );
    return kept.length === Object.keys(state).length
      ? state
      : Object.fromEntries(kept);
  }
  const current = state[action.tileId] ?? initialWidgetRun({});
  const next = widgetRunReducer(current, action.action);
  return next === current ? state : { ...state, [action.tileId]: next };
};
