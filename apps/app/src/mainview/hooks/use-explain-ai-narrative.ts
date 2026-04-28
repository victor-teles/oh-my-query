import { streamText } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ExplainResult } from "@/lib/tauri";

import { classifyAIError } from "@/lib/ai-errors";
import { createAIModel } from "@/lib/ai-provider";
import { getAISettings } from "@/lib/ai-settings";
import { buildExplainNarrativePrompt } from "@/lib/explain-ai-context";

export type NarrativeStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "error";

export interface NarrativeState {
  status: NarrativeStatus;
  text: string;
  errorMessage: string | null;
  resultKey: string | null;
}

const SYSTEM_PROMPT =
  "You are a database performance expert. Analyze EXPLAIN plans and produce concise, actionable diagnoses. Always reference the actual cost numbers provided. Never invent statistics or guess table/column names not present in the plan.";

const makeResultKey = (result: ExplainResult): string =>
  `${result.engine}-${result.executionTimeMs}-${result.root.id}`;

export const useExplainAiNarrative = () => {
  const [state, setState] = useState<NarrativeState>({
    errorMessage: null,
    resultKey: null,
    status: "idle",
    text: "",
  });

  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (result: ExplainResult, sql: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const resultKey = makeResultKey(result);

    setState({ errorMessage: null, resultKey, status: "loading", text: "" });

    try {
      const settings = await getAISettings();
      if (!settings) {
        setState((prev) => ({
          ...prev,
          errorMessage:
            "AI is not configured. Open settings to add your API key.",
          status: "error",
        }));
        return;
      }

      const model = createAIModel(settings);
      const userMessage = buildExplainNarrativePrompt(result, sql);

      setState((prev) => ({ ...prev, status: "streaming" }));

      const stream = streamText({
        abortSignal: controller.signal,
        messages: [{ content: userMessage, role: "user" }],
        model,
        system: SYSTEM_PROMPT,
      });

      for await (const chunk of stream.textStream) {
        if (controller.signal.aborted) {
          break;
        }
        setState((prev) => ({ ...prev, text: prev.text + chunk }));
      }

      if (!controller.signal.aborted) {
        setState((prev) => ({ ...prev, status: "done" }));
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (abortRef.current === controller) {
          setState({
            errorMessage: null,
            resultKey: null,
            status: "idle",
            text: "",
          });
        }
        return;
      }
      const classified = classifyAIError(error);
      setState((prev) => ({
        ...prev,
        errorMessage: `${classified.message} ${classified.suggestion}`,
        status: "error",
      }));
    }
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState({ errorMessage: null, resultKey: null, status: "idle", text: "" });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ errorMessage: null, resultKey: null, status: "idle", text: "" });
  }, []);

  return { analyze, reset, state, stop };
};
