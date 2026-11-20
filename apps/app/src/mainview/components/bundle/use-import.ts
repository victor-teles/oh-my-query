import { useCallback, useMemo, useReducer } from "react";

import type { ImportSource } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { applyImport, previewImport } from "@/lib/ipc";

import type { ImportState } from "./import-reducer";

import {
  applyRequestOf,
  importCounts,
  importReducer,
  INITIAL_IMPORT,
  isReview,
} from "./import-reducer";

const canRead = (state: ImportState): boolean =>
  state.phase === "choose" || state.phase === "invalid";

const canApply = (state: ImportState): boolean => {
  if (!(state.phase === "review" || state.phase === "error")) {
    return false;
  }
  const counts = importCounts(state);
  return counts.widgets + counts.boards > 0;
};

export const useImport = () => {
  const [state, dispatch] = useReducer(importReducer, INITIAL_IMPORT);

  const read = useCallback(
    async (source: ImportSource) => {
      if (!canRead(state)) {
        return;
      }
      dispatch({ source, type: "read" });
      try {
        const preview = await previewImport(source);
        if (preview.status === "cancelled") {
          dispatch({ type: "cancelled" });
        } else if (preview.status === "invalid") {
          dispatch({ message: preview.message, type: "invalid" });
        } else {
          dispatch({
            bundle: preview.bundle,
            plan: preview.plan,
            type: "loaded",
          });
        }
      } catch (error) {
        dispatch({
          message: getErrorMessage(error, "The export couldn't be read."),
          type: "invalid",
        });
      }
    },
    [state]
  );

  const apply = useCallback(async () => {
    if (!(isReview(state) && canApply(state))) {
      return;
    }
    dispatch({ type: "importing" });
    try {
      const result = await applyImport(applyRequestOf(state));
      dispatch({ result, type: "imported" });
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, "The import failed."),
        type: "failed",
      });
    }
  }, [state]);

  const edits = useMemo(
    () => ({
      map: (ref: string, connectionId: string | null) =>
        dispatch({ connectionId, ref, type: "map" }),
      toggleBoards: () => dispatch({ type: "toggleBoards" }),
      toggleSql: (ref: string) => dispatch({ ref, type: "toggleSql" }),
      toggleWidget: (ref: string) => dispatch({ ref, type: "toggleWidget" }),
    }),
    []
  );

  return { apply, canApply: canApply(state), edits, read, state };
};

export type Importer = ReturnType<typeof useImport>;
export type ImportEdits = Importer["edits"];
