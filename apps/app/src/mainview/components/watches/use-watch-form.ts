import { editableParams, formatThreshold, isKpiSpec } from "@oh-my-query/rpc";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type {
  ParamValues,
  Watch,
  WatchCondition,
  WatchDraft,
  WatchInterval,
  Widget,
} from "@/lib/ipc";

import { currentValues } from "@/components/widgets/param-labels";
import { getErrorMessage } from "@/lib/error-message";

import { useWatches } from "./watches-provider";

export type ConditionChoice = "none" | WatchCondition["kind"];

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export interface WatchFormState {
  interval: WatchInterval;
  menuBar: boolean;
  condition: ConditionChoice;
  threshold: string;
  values: ParamValues;
  save: SaveState;
}

type WatchFormAction =
  | { type: "interval"; interval: WatchInterval }
  | { type: "menuBar"; menuBar: boolean }
  | { type: "condition"; condition: ConditionChoice }
  | { type: "threshold"; threshold: string }
  | { type: "values"; values: ParamValues }
  | { type: "save"; save: SaveState };

export const SAVED_HOLD_MS = 700;

export const needsThreshold = (condition: ConditionChoice): boolean =>
  condition === "below" || condition === "above";

export const editableValues = (widget: Widget): ParamValues => {
  const all = currentValues(widget);
  return Object.fromEntries(
    editableParams(widget.params).flatMap((param) => {
      const value = all[param.name];
      return value === undefined ? [] : [[param.name, value]];
    })
  );
};

export const initialWatchForm = (
  widget: Widget,
  watch: Watch | null
): WatchFormState => ({
  condition: watch?.alert?.kind ?? "none",
  interval: watch?.interval ?? "5m",
  menuBar: watch?.menuBar ?? false,
  save: { kind: "idle" },
  threshold:
    watch?.alert && "threshold" in watch.alert
      ? String(watch.alert.threshold)
      : "",
  values: watch?.values ?? editableValues(widget),
});

export const watchFormReducer = (
  state: WatchFormState,
  action: WatchFormAction
): WatchFormState => {
  switch (action.type) {
    case "interval": {
      return { ...state, interval: action.interval };
    }
    case "menuBar": {
      return { ...state, menuBar: action.menuBar };
    }
    case "condition": {
      return { ...state, condition: action.condition };
    }
    case "threshold": {
      return { ...state, threshold: action.threshold };
    }
    case "values": {
      return { ...state, values: action.values };
    }
    default: {
      return { ...state, save: action.save };
    }
  }
};

export const parseThreshold = (text: string): number | null => {
  if (text.trim() === "") {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const conditionOf = (
  choice: ConditionChoice,
  threshold: number | null
): WatchCondition | null => {
  switch (choice) {
    case "below":
    case "above": {
      return threshold === null ? null : { kind: choice, threshold };
    }
    case "hasRows":
    case "changed": {
      return { kind: choice };
    }
    default: {
      return null;
    }
  }
};

export const draftOfForm = (
  widget: Widget,
  watch: Watch | null,
  state: WatchFormState
): WatchDraft | null => {
  const threshold = parseThreshold(state.threshold);
  if (needsThreshold(state.condition) && threshold === null) {
    return null;
  }
  const kpi = isKpiSpec(widget.spec);
  return {
    alert: conditionOf(state.condition, threshold),
    id: watch?.id,
    interval: state.interval,
    menuBar: kpi && state.menuBar,
    paused: watch?.paused ?? false,
    values: state.values,
    widgetId: widget.id,
  };
};

interface UseWatchFormOptions {
  widget: Widget;
  watch: Watch | null;
  onSaved: () => void;
}

export const useWatchForm = ({
  widget,
  watch,
  onSaved,
}: UseWatchFormOptions) => {
  const { save } = useWatches();
  const [state, dispatch] = useReducer(watchFormReducer, null, () =>
    initialWatchForm(widget, watch)
  );
  const hold = useRef(0);

  useEffect(() => () => window.clearTimeout(hold.current), []);

  const threshold = parseThreshold(state.threshold);
  const thresholdError =
    needsThreshold(state.condition) &&
    state.threshold.trim() !== "" &&
    threshold === null
      ? "Enter a number, like 50000."
      : null;
  const preview =
    threshold !== null ? formatThreshold(widget.spec, threshold) : null;

  const submit = useCallback(async () => {
    const draft = draftOfForm(widget, watch, state);
    if (!draft || state.save.kind === "saving") {
      return;
    }
    dispatch({ save: { kind: "saving" }, type: "save" });
    try {
      await save(draft);
      dispatch({ save: { kind: "saved" }, type: "save" });
      hold.current = window.setTimeout(onSaved, SAVED_HOLD_MS);
    } catch (error) {
      dispatch({
        save: {
          kind: "error",
          message: getErrorMessage(error, "The watch could not be saved."),
        },
        type: "save",
      });
    }
  }, [onSaved, save, state, watch, widget]);

  return {
    canSave: draftOfForm(widget, watch, state) !== null,
    dispatch,
    preview,
    state,
    submit,
    thresholdError,
  };
};

export type WatchForm = ReturnType<typeof useWatchForm>;
