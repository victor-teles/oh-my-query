import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { ParamValues } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { cancelWidgetRun, runWidget } from "@/lib/ipc";

import type { WidgetRunFailure } from "./widget-run-reducer";

import { initialWidgetRun, widgetRunReducer } from "./widget-run-reducer";

export const failureOf = (error: unknown): WidgetRunFailure => ({
  code:
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "QUERY_FAILED",
  message: getErrorMessage(error, "The widget could not run."),
});

const stopOnBun = async (runId: string): Promise<void> => {
  try {
    await cancelWidgetRun(runId);
  } catch (error) {
    console.error("[widgets] cancel failed", error);
  }
};

// Opens with a run: a widget view always shows fresh data for its values.
export const useWidgetRun = (widgetId: string, initialValues: ParamValues) => {
  const [openingValues] = useState(initialValues);
  const [state, dispatch] = useReducer(
    widgetRunReducer,
    initialValues,
    initialWidgetRun
  );
  const inFlight = useRef<string | null>(null);

  const run = useCallback(
    async (values: ParamValues) => {
      const previous = inFlight.current;
      if (previous) {
        stopOnBun(previous);
      }
      const runId = crypto.randomUUID();
      inFlight.current = runId;
      dispatch({ runId, type: "start", values });
      try {
        const outcome = await runWidget({ runId, values, widgetId });
        dispatch({ outcome, runId, type: "success" });
      } catch (error) {
        dispatch({ failure: failureOf(error), runId, type: "failure" });
      } finally {
        if (inFlight.current === runId) {
          inFlight.current = null;
        }
      }
    },
    [widgetId]
  );

  const cancel = useCallback(() => {
    const runId = inFlight.current;
    if (!runId) {
      return;
    }
    inFlight.current = null;
    stopOnBun(runId);
    dispatch({ type: "cancel" });
  }, []);

  useEffect(() => {
    run(openingValues);
  }, [openingValues, run]);

  useEffect(
    () => () => {
      const runId = inFlight.current;
      if (runId) {
        stopOnBun(runId);
      }
    },
    []
  );

  return { cancel, run, state };
};

export type WidgetRunSession = ReturnType<typeof useWidgetRun>;
