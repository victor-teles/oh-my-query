import { useCallback, useEffect, useState } from "react";

import type { Widget, WidgetDraft } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { proposeWidgetParams } from "@/lib/ipc";

import type { AnsweredAsk } from "./widget-draft";

import { draftFromAsk } from "./widget-draft";
import { useWidgets } from "./widgets-provider";

export type SaveIntent = "save" | "board";

export type SavePhase =
  | { kind: "idle" }
  | { kind: "naming"; intent: SaveIntent }
  | { kind: "saving" }
  | { kind: "saved"; widget: Widget }
  | { kind: "finding" }
  | { kind: "unavailable" }
  | { kind: "failed"; during: "save" | "inputs"; message: string };

const IDLE: SavePhase = { kind: "idle" };
const UNAVAILABLE: SavePhase = { kind: "unavailable" };
export const UNAVAILABLE_MS = 2400;

interface UseAskSaveOptions {
  answered: AnsweredAsk | null;
  unavailable?: boolean;
  onReviewInputs: (draft: WidgetDraft) => void;
  onSavedForBoard: (widgetId: string) => void;
}

export const useAskSave = ({
  answered,
  unavailable = false,
  onReviewInputs,
  onSavedForBoard,
}: UseAskSaveOptions) => {
  const { save, markFresh } = useWidgets();
  const [phase, setPhase] = useState<SavePhase>(IDLE);
  const spec = answered?.spec ?? null;
  const [specFor, setSpecFor] = useState(spec);
  if (spec !== specFor) {
    setSpecFor(spec);
    setPhase(IDLE);
  }

  const busy = phase.kind === "saving" || phase.kind === "finding";
  const showingUnavailable = phase.kind === "unavailable";

  useEffect(() => {
    if (!showingUnavailable) {
      return;
    }
    const timer = setTimeout(
      () => setPhase((current) => (current === UNAVAILABLE ? IDLE : current)),
      UNAVAILABLE_MS
    );
    return () => clearTimeout(timer);
  }, [showingUnavailable]);

  const beginNaming = useCallback(
    (intent: SaveIntent = "save") => {
      if (unavailable) {
        setPhase(UNAVAILABLE);
      } else if (answered && !busy) {
        setPhase({ intent, kind: "naming" });
      }
    },
    [answered, busy, unavailable]
  );

  const cancelNaming = useCallback(
    () => setPhase((current) => (current.kind === "naming" ? IDLE : current)),
    []
  );

  const confirmName = useCallback(
    async (name: string) => {
      if (!(answered && phase.kind === "naming")) {
        return;
      }
      const { intent } = phase;
      setPhase({ kind: "saving" });
      try {
        const widget = await save(draftFromAsk(answered, name));
        markFresh(widget.id);
        setPhase({ kind: "saved", widget });
        if (intent === "board") {
          onSavedForBoard(widget.id);
        }
      } catch (error) {
        setPhase({
          during: "save",
          kind: "failed",
          message: getErrorMessage(error, "The widget could not be saved."),
        });
      }
    },
    [answered, markFresh, onSavedForBoard, phase, save]
  );

  const findInputs = useCallback(async () => {
    if (unavailable) {
      setPhase(UNAVAILABLE);
      return;
    }
    if (!answered || busy) {
      return;
    }
    setPhase({ kind: "finding" });
    try {
      const proposal = await proposeWidgetParams({
        dialect: answered.dialect,
        prompt: answered.prompt,
        sql: answered.sql,
      });
      if ("error" in proposal) {
        setPhase({ during: "inputs", kind: "failed", message: proposal.error });
        return;
      }
      setPhase(IDLE);
      onReviewInputs(draftFromAsk(answered, answered.spec.title, proposal));
    } catch (error) {
      setPhase({
        during: "inputs",
        kind: "failed",
        message: getErrorMessage(error, "Inputs could not be found."),
      });
    }
  }, [answered, busy, onReviewInputs, unavailable]);

  return { beginNaming, cancelNaming, confirmName, findInputs, phase };
};

export type AskSave = ReturnType<typeof useAskSave>;
