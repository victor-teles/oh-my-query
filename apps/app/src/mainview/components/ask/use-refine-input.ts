import type { ChangeEvent, KeyboardEvent, RefObject } from "react";

import { useLayoutEffect, useState } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { DatabaseConnection } from "@/lib/ipc";

import { matchViewSwitch } from "@/lib/view-switch";

import type { AskState } from "./ask-reducer";
import type { ChipPrefill } from "./assumption-chips";
import type { RefineGhost } from "./refine-overlay";
import type { AskSession } from "./use-ask";

import { draftOf, submissionOf } from "./ask-draft";
import { askActionLabel } from "./ask-labels";
import { atTurnLimit, canRefine, isWorking, shownTurn } from "./ask-reducer";

const ASK_PLACEHOLDER = "Ask about your data…";
const REFINE_PLACEHOLDER = "Refine — by month, only Europe, as a table…";
const LIMIT_PLACEHOLDER = "Start a new question with ⌘↵";

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const isRefinable = (state: AskState): boolean =>
  state.source === "question" && shownTurn(state) !== null;

// The input holds the question while the first turn runs; once an answer is
// on screen it empties for a follow-up, or holds the follow-up that failed.
const defaultDraftOf = (state: AskState): string => {
  if (!isRefinable(state)) {
    return draftOf(state);
  }
  return state.status === "error" ? state.prompt : "";
};

const placeholderOf = (state: AskState): string => {
  if (!isRefinable(state)) {
    return ASK_PLACEHOLDER;
  }
  return atTurnLimit(state) ? LIMIT_PLACEHOLDER : REFINE_PLACEHOLDER;
};

const actionLabelOf = (state: AskState, draft: string): string | null => {
  const source = submissionOf(draft)?.source;
  if (isRefinable(state) && source !== "sql") {
    return atTurnLimit(state) ? null : "Refine";
  }
  return askActionLabel(
    source ?? state.source,
    draft.trim() === draftOf(state)
  );
};

interface UseRefineInputOptions {
  session: AskSession;
  connection: DatabaseConnection | null;
  views: readonly CardViewKind[];
  inputRef: RefObject<HTMLInputElement | null>;
  onAltEnter: (() => void) | null;
}

export const useRefineInput = ({
  session,
  connection,
  views,
  inputRef,
  onAltEnter,
}: UseRefineInputOptions) => {
  const { state, start, startSql, refine, selectView, stepTurn } = session;
  const fallback = defaultDraftOf(state);
  const [draft, setDraft] = useState(fallback);
  const [previousFallback, setPreviousFallback] = useState(fallback);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState<ChipPrefill["selection"]>(null);
  if (fallback !== previousFallback) {
    setPreviousFallback(fallback);
    if (draft === previousFallback) {
      setDraft(fallback);
    }
  }

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!(selection && input)) {
      return;
    }
    input.focus();
    input.setSelectionRange(selection[0], selection[1]);
  }, [inputRef, selection]);

  const target = connection
    ? { connectionId: connection.id, database: null }
    : null;
  const refinable = isRefinable(state);

  const submit = (text: string, fresh: boolean) => {
    const submission = submissionOf(text);
    if (!(submission && target)) {
      return;
    }
    if (submission.source === "sql") {
      startSql(submission.text, target);
      return;
    }
    if (fresh || !refinable) {
      start(submission.text, target);
      return;
    }
    const view = matchViewSwitch(submission.text, views);
    if (view && !isWorking(state.status)) {
      setDraft("");
      selectView(view);
      return;
    }
    if (canRefine(state)) {
      setDraft("");
      setNotice(null);
      refine(submission.text, target);
    }
  };

  const retry = () => {
    if (refinable && target) {
      refine(state.prompt, target);
    } else {
      submit(draftOf(state), true);
    }
  };

  const prefill = ({ text, selection: range }: ChipPrefill) => {
    setDraft(text);
    setNotice(`Ready to refine: ${text}`);
    setSelection(range ?? [text.length, text.length]);
  };

  const step = (event: KeyboardEvent<HTMLInputElement>) => {
    const delta = STEPS[event.key];
    if (delta === undefined || draft !== "" || isWorking(state.status)) {
      return;
    }
    const to = state.position + delta;
    if (state.turns[to]) {
      event.preventDefault();
      stepTurn(to);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      step(event);
      return;
    }
    event.preventDefault();
    if (event.altKey && onAltEnter) {
      onAltEnter();
    } else {
      submit(draft, event.metaKey);
    }
  };

  const ghost: RefineGhost | null =
    draft.trim() !== "" &&
    canRefine(state) &&
    state.position === state.turns.length - 1 &&
    !matchViewSwitch(draft, views)
      ? { index: state.position + 1, text: draft }
      : null;

  return {
    actionLabel: actionLabelOf(state, draft),
    draft,
    ghost,
    handleChange: (event: ChangeEvent<HTMLInputElement>) =>
      setDraft(event.target.value),
    handleKeyDown,
    handleSubmit: () => submit(draft, false),
    notice,
    overlay: { draft, ghost, placeholder: placeholderOf(state) },
    placeholder: placeholderOf(state),
    prefill,
    retry,
  };
};
