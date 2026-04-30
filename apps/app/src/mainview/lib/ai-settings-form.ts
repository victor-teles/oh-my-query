import type { AIProvider, AISettings } from "@/lib/ai-settings";

const DEFAULT_LOCAL_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.5-flash",
  local: "llama3",
  openai: "gpt-4.1",
  openrouter: "anthropic/claude-sonnet-4",
};

interface AISettingsDraft {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const normalizeAISettingsDraft = (
  draft: AISettingsDraft
): AISettings => {
  const apiKey = draft.apiKey.trim();
  const model = draft.model.trim() || DEFAULT_MODELS[draft.provider];
  const baseUrl =
    draft.provider === "local"
      ? draft.baseUrl.trim() || DEFAULT_LOCAL_BASE_URL
      : draft.baseUrl.trim() || undefined;

  return {
    apiKey,
    baseUrl,
    model,
    provider: draft.provider,
  };
};

export const canSaveAISettingsDraft = (
  draft: AISettingsDraft | AISettings
): boolean => {
  const normalized = normalizeAISettingsDraft({
    apiKey: draft.apiKey,
    baseUrl: draft.baseUrl ?? "",
    model: draft.model ?? "",
    provider: draft.provider,
  });

  return normalized.provider === "local" || normalized.apiKey.length > 0;
};

export const isAISettingsConfigured = (
  settings: AISettings | null
): boolean => {
  if (!settings) {
    return false;
  }

  return settings.provider === "local"
    ? Boolean(settings.baseUrl)
    : settings.apiKey.trim().length > 0;
};
