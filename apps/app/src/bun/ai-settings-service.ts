import type { LanguageModel } from "@conch/agent";
import type {
  AiSettingsInput,
  AiTestResult,
  RedactedAiSettings,
} from "@conch/rpc";

import { createAIModel, probeModel, resolveModelId } from "@conch/agent";
import {
  clearAiKey,
  getAiSettings,
  mergeAiSettings,
  redactAiSettings,
  saveAiSettings,
} from "@conch/core";
import { AI_PROVIDER_INFO, AI_PROVIDERS, isAiProvider } from "@conch/rpc";
import { z } from "zod";

export const aiSettingsInputSchema = z.object({
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  provider: z.enum(AI_PROVIDERS),
});

const toRedacted = (
  record: ReturnType<typeof redactAiSettings>
): RedactedAiSettings | null => {
  if (!record || !isAiProvider(record.provider)) {
    return null;
  }
  return { ...record, provider: record.provider };
};

export const readAiSettings = async (): Promise<RedactedAiSettings | null> =>
  toRedacted(redactAiSettings(await getAiSettings()));

export const writeAiSettings = async (
  input: AiSettingsInput
): Promise<RedactedAiSettings> => {
  const saved = await saveAiSettings(aiSettingsInputSchema.parse(input));
  const redacted = toRedacted(redactAiSettings(saved));
  if (!redacted) {
    throw new Error(`Unsupported AI provider: ${saved.provider}`);
  }
  return redacted;
};

export const removeAiKey = async (): Promise<RedactedAiSettings | null> =>
  toRedacted(redactAiSettings(await clearAiKey()));

const failure = (message: string, latencyMs = 0): AiTestResult => ({
  latencyMs,
  message,
  ok: false,
});

export const testAiSettings = async (
  input: AiSettingsInput
): Promise<AiTestResult> => {
  const draft = mergeAiSettings(
    await getAiSettings(),
    aiSettingsInputSchema.parse(input)
  );
  const provider = aiSettingsInputSchema.shape.provider.parse(draft.provider);
  const settings = { ...draft, provider };
  if (AI_PROVIDER_INFO[provider].needsKey && !settings.apiKey) {
    return failure("Add an API key to test this provider.");
  }
  const modelId = resolveModelId(settings);
  if (!modelId) {
    return failure("Choose a model to test this provider.");
  }

  return probeModel(createAIModel(settings, modelId), modelId);
};

export const loadAskModel = async (): Promise<LanguageModel | null> => {
  const stored = await getAiSettings();
  if (!(stored && isAiProvider(stored.provider))) {
    return null;
  }
  const settings = { ...stored, provider: stored.provider };
  const modelId = resolveModelId(settings);
  if (
    !modelId ||
    (AI_PROVIDER_INFO[settings.provider].needsKey && !settings.apiKey)
  ) {
    return null;
  }
  return createAIModel(settings, modelId);
};
