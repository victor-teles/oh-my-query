import type { AiTestResult } from "@conch/rpc";
import type { LanguageModel } from "ai";

import { generateText } from "ai";

import { classifyAIError } from "./ai-errors.ts";

const PROBE_TIMEOUT_MS = 10_000;

export const probeModel = async (
  model: LanguageModel,
  modelId: string
): Promise<AiTestResult> => {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    await generateText({
      abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      maxOutputTokens: 32,
      model,
      prompt: "Reply with the single word OK.",
    });
    return {
      latencyMs: elapsed(),
      message: `Connected to ${modelId}`,
      ok: true,
    };
  } catch (error) {
    const { message, suggestion } = classifyAIError(error);
    return {
      latencyMs: elapsed(),
      message: `${message} ${suggestion}`,
      ok: false,
    };
  }
};
