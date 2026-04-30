import { streamText } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ExplainResult } from "@/lib/tauri";

import { classifyAIError } from "@/lib/ai-errors";
import { createAIModel } from "@/lib/ai-provider";
import { getAISettings } from "@/lib/ai-settings";
import { formatExplainContext } from "@/lib/explain-ai-context";

export type NarrativeStatus =
  | "idle"
  | "streaming"
  | "done"
  | "error"
  | "unconfigured";

export interface PlanNarrativeState {
  status: NarrativeStatus;
  content: string;
  errorMessage: string | null;
  errorRetryable: boolean;
}

export interface PlanNarrativeActions {
  run: (result: ExplainResult, sql: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export type PlanNarrative = PlanNarrativeState & PlanNarrativeActions;

const IDLE: PlanNarrativeState = {
  content: "",
  errorMessage: null,
  errorRetryable: false,
  status: "idle",
};

const SYSTEM_PROMPT = `You are a database performance expert. Given an EXPLAIN plan, respond in exactly this structure:

**Diagnosis:** One sentence identifying the primary bottleneck. Include the actual timing or cost from the plan.

**Fix 1:** Brief description (two sentences max). Only propose fixes with direct evidence in the plan.
\`\`\`sql
-- runnable SQL if this fix requires a schema change (CREATE INDEX, etc.)
\`\`\`

**Fix 2:** Brief description.
\`\`\`sql
-- SQL if applicable
\`\`\`

**Fix 3:** Brief description (omit if fewer than three fixes are warranted).
\`\`\`sql
-- SQL if applicable
\`\`\`

Rules:
- Use actual timing numbers and node names from the plan. Never invent stats.
- Only suggest CREATE INDEX when the plan shows a sequential scan that accounts for significant cost.
- Order fixes by impact, highest first.
- Use real table and column names from the plan.
- Do not add preamble, caveats, or a closing summary. Only the sections above.`;

export const usePlanNarrative = (): PlanNarrative => {
  const [state, setState] = useState<PlanNarrativeState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (result: ExplainResult, sql: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...IDLE, status: "streaming" });

    try {
      const settings = await getAISettings();
      if (!settings) {
        if (mountedRef.current && abortRef.current === controller) {
          setState({ ...IDLE, status: "unconfigured" });
        }
        return;
      }

      const model = createAIModel(settings);
      const planContext = formatExplainContext(result, sql);

      const stream = streamText({
        abortSignal: controller.signal,
        messages: [{ content: planContext, role: "user" }],
        model,
        system: SYSTEM_PROMPT,
      });

      for await (const chunk of stream.textStream) {
        if (!mountedRef.current || abortRef.current !== controller) {
          break;
        }
        setState((prev) => ({ ...prev, content: prev.content + chunk }));
      }

      if (mountedRef.current && abortRef.current === controller) {
        setState((prev) => ({ ...prev, status: "done" }));
      }
    } catch (error) {
      if (!mountedRef.current || abortRef.current !== controller) {
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        setState(IDLE);
        return;
      }
      const classified = classifyAIError(error);
      setState({
        content: "",
        errorMessage: classified.message,
        errorRetryable: classified.retryable,
        status: "error",
      });
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, cancel, reset, run };
};
