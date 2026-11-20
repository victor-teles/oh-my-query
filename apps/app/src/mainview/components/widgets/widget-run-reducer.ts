import type { ParamValues, WidgetRunResult } from "@/lib/ipc";

export type WidgetRunStatus = "idle" | "running" | "done" | "error";

export interface WidgetRunFailure {
  code: string;
  message: string;
}

export interface WidgetRunState {
  status: WidgetRunStatus;
  runId: string | null;
  values: ParamValues;
  outcome: WidgetRunResult | null;
  failure: WidgetRunFailure | null;
  completedRuns: number;
}

export type WidgetRunAction =
  | { type: "start"; runId: string; values: ParamValues }
  | { type: "success"; runId: string; outcome: WidgetRunResult }
  | { type: "failure"; runId: string; failure: WidgetRunFailure }
  | { type: "cancel" };

export const initialWidgetRun = (values: ParamValues): WidgetRunState => ({
  completedRuns: 0,
  failure: null,
  outcome: null,
  runId: null,
  status: "idle",
  values,
});

export const widgetRunReducer = (
  state: WidgetRunState,
  action: WidgetRunAction
): WidgetRunState => {
  switch (action.type) {
    case "start": {
      return {
        ...state,
        failure: null,
        runId: action.runId,
        status: "running",
        values: action.values,
      };
    }
    case "success": {
      if (action.runId !== state.runId) {
        return state;
      }
      return {
        ...state,
        completedRuns: state.completedRuns + 1,
        outcome: action.outcome,
        runId: null,
        status: "done",
        values: action.outcome.values,
      };
    }
    case "failure": {
      if (action.runId !== state.runId) {
        return state;
      }
      return {
        ...state,
        failure: action.failure,
        runId: null,
        status: "error",
      };
    }
    case "cancel": {
      if (state.status !== "running") {
        return state;
      }
      return {
        ...state,
        runId: null,
        status: state.outcome ? "done" : "idle",
      };
    }
    default: {
      return state;
    }
  }
};
