import { useCallback, useState } from "react";

import type { ParamDef } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { loadParamOptions } from "@/lib/ipc";

type SelectParam = Extract<ParamDef, { type: "select" }>;

export type ParamOptions =
  | { status: "idle" | "loading"; options: readonly string[] }
  | { status: "ready"; options: readonly string[] }
  | { status: "error"; options: readonly string[]; message: string };

const initialOptions = (param: SelectParam): ParamOptions =>
  param.optionsSql
    ? { options: [], status: "idle" }
    : { options: param.options ?? [], status: "ready" };

export const useParamOptions = (widgetId: string, param: SelectParam) => {
  const [state, setState] = useState<ParamOptions>(() => initialOptions(param));

  const ensureLoaded = useCallback(async () => {
    if (state.status !== "idle") {
      return;
    }
    setState({ options: [], status: "loading" });
    try {
      const options = await loadParamOptions(widgetId, param.name);
      setState({ options, status: "ready" });
    } catch (error) {
      setState({
        message: getErrorMessage(error, "Options could not load."),
        options: [],
        status: "error",
      });
    }
  }, [param.name, state.status, widgetId]);

  return { ensureLoaded, state };
};
