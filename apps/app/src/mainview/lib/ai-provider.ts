import type { LanguageModel } from "ai";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import type { AISettings } from "@/lib/ai-settings";

import { getDefaultModel } from "@/lib/ai-settings";

export const createAIModel = (settings: AISettings): LanguageModel => {
  const model = settings.model ?? getDefaultModel(settings.provider);

  switch (settings.provider) {
    case "openai":
    case "local": {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseUrl,
      });
      return openai(model);
    }
    case "openrouter": {
      const openrouter = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return openrouter(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
      });
      return anthropic(model);
    }
    default: {
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
    }
  }
};
