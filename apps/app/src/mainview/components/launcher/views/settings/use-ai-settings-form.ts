import type { AiProvider } from "@conch/rpc";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { getErrorMessage } from "@/lib/error-message";
import {
  clearAiKey,
  getAiSettings,
  saveAiSettings,
  testAiSettings,
} from "@/lib/ipc";

import type { AiDraft } from "./ai-settings-draft";

import { draftToInput, isDraftDirty } from "./ai-settings-draft";
import { aiFormReducer, initialAiFormState } from "./ai-settings-reducer";

export const SAVED_LABEL_MS = 1500;

export const useAiSettingsForm = () => {
  const [state, dispatch] = useReducer(aiFormReducer, initialAiFormState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await getAiSettings();
        if (!cancelled) {
          dispatch({ settings, type: "loaded" });
        }
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, "AI settings could not load.");
          dispatch({ message, type: "load-failed" });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.phase.status !== "saved") {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "save-settled" }),
      SAVED_LABEL_MS
    );
    return () => window.clearTimeout(timer);
  }, [state.phase.status]);

  const retry = useCallback(() => {
    dispatch({ type: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const edit = useCallback(
    (patch: Partial<Omit<AiDraft, "provider">>) =>
      dispatch({ patch, type: "edit" }),
    []
  );

  const setProvider = useCallback(
    (provider: AiProvider) => dispatch({ provider, type: "provider" }),
    []
  );

  const { draft } = state;

  const save = useCallback(async () => {
    dispatch({ type: "save-start" });
    try {
      dispatch({
        settings: await saveAiSettings(draftToInput(draft)),
        type: "saved",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Settings could not be saved.");
      dispatch({ message, type: "save-failed" });
    }
  }, [draft]);

  const clearKey = useCallback(async () => {
    dispatch({ type: "save-start" });
    try {
      dispatch({ settings: await clearAiKey(), type: "saved" });
    } catch (error) {
      const message = getErrorMessage(error, "The key could not be removed.");
      dispatch({ message, type: "save-failed" });
    }
  }, []);

  const test = useCallback(async () => {
    dispatch({ type: "test-start" });
    try {
      dispatch({
        result: await testAiSettings(draftToInput(draft)),
        type: "tested",
      });
    } catch (error) {
      const message = getErrorMessage(error, "The test could not run.");
      dispatch({
        result: { latencyMs: 0, message, ok: false },
        type: "tested",
      });
    }
  }, [draft]);

  const dirty = isDraftDirty(draft, state.saved);

  return useMemo(
    () => ({ clearKey, dirty, edit, retry, save, setProvider, state, test }),
    [clearKey, dirty, edit, retry, save, setProvider, state, test]
  );
};
