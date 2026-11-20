import type {
  AiProvider,
  AiTestResult,
  RedactedAiSettings,
} from "@oh-my-query/rpc";

import type { AiDraft } from "./ai-settings-draft";

import { draftFromSettings, switchProvider } from "./ai-settings-draft";

export type AiFormPhase =
  | { status: "loading" }
  | { status: "load-failed"; message: string }
  | { status: "editing" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "save-failed"; message: string };

export type AiTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "done"; result: AiTestResult };

export interface AiFormState {
  phase: AiFormPhase;
  saved: RedactedAiSettings | null;
  draft: AiDraft;
  test: AiTestState;
}

export type AiFormAction =
  | { type: "loading" }
  | { type: "loaded"; settings: RedactedAiSettings | null }
  | { type: "load-failed"; message: string }
  | { type: "edit"; patch: Partial<Omit<AiDraft, "provider">> }
  | { type: "provider"; provider: AiProvider }
  | { type: "save-start" }
  | { type: "saved"; settings: RedactedAiSettings | null }
  | { type: "save-failed"; message: string }
  | { type: "save-settled" }
  | { type: "test-start" }
  | { type: "tested"; result: AiTestResult };

export const initialAiFormState: AiFormState = {
  draft: draftFromSettings(null),
  phase: { status: "loading" },
  saved: null,
  test: { status: "idle" },
};

const IDLE_TEST: AiTestState = { status: "idle" };
const EDITING: AiFormPhase = { status: "editing" };

export const aiFormReducer = (
  state: AiFormState,
  action: AiFormAction
): AiFormState => {
  switch (action.type) {
    case "loading": {
      return { ...state, phase: { status: "loading" } };
    }
    case "loaded": {
      return {
        draft: draftFromSettings(action.settings),
        phase: EDITING,
        saved: action.settings,
        test: IDLE_TEST,
      };
    }
    case "load-failed": {
      return {
        ...state,
        phase: { message: action.message, status: "load-failed" },
      };
    }
    case "edit": {
      return {
        ...state,
        draft: { ...state.draft, ...action.patch },
        phase: EDITING,
        test: IDLE_TEST,
      };
    }
    case "provider": {
      return {
        ...state,
        draft: switchProvider(state.draft, action.provider, state.saved),
        phase: EDITING,
        test: IDLE_TEST,
      };
    }
    case "save-start": {
      return { ...state, phase: { status: "saving" } };
    }
    case "saved": {
      return {
        ...state,
        draft: draftFromSettings(action.settings),
        phase: { status: "saved" },
        saved: action.settings,
      };
    }
    case "save-failed": {
      return {
        ...state,
        phase: { message: action.message, status: "save-failed" },
      };
    }
    case "save-settled": {
      return state.phase.status === "saved"
        ? { ...state, phase: EDITING }
        : state;
    }
    case "test-start": {
      return { ...state, test: { status: "testing" } };
    }
    case "tested": {
      return { ...state, test: { result: action.result, status: "done" } };
    }
    default: {
      return state;
    }
  }
};
