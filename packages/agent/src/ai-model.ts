import type { AiProvider } from "@oh-my-query/rpc";
import type { LanguageModel } from "ai";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_PROVIDER_INFO } from "@oh-my-query/rpc";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface ModelSettings {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export const resolveModelId = (settings: ModelSettings): string | null =>
  settings.model ?? AI_PROVIDER_INFO[settings.provider].defaultModel;

export const createAIModel = (
  settings: ModelSettings,
  modelId: string
): LanguageModel => {
  switch (settings.provider) {
    case "openai": {
      return createOpenAI({ apiKey: settings.apiKey })(modelId);
    }
    case "local": {
      return createOpenAI({
        apiKey: settings.apiKey || "local",
        baseURL:
          settings.baseUrl ?? AI_PROVIDER_INFO.local.defaultBaseUrl ?? "",
      }).chat(modelId);
    }
    case "openrouter": {
      return createOpenAI({
        apiKey: settings.apiKey,
        baseURL: OPENROUTER_BASE_URL,
      }).chat(modelId);
    }
    case "anthropic": {
      return createAnthropic({ apiKey: settings.apiKey })(modelId);
    }
    case "google": {
      return createGoogleGenerativeAI({ apiKey: settings.apiKey })(modelId);
    }
    default: {
      throw new Error(
        `Unsupported AI provider: ${settings.provider satisfies never}`
      );
    }
  }
};
