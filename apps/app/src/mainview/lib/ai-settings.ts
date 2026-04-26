import {
  isAISettingsConfigured,
  normalizeAISettingsDraft,
} from "@/lib/ai-settings-form";
import { getConfig, saveConfig } from "@/lib/ipc";

export type AIProvider = "openai" | "anthropic" | "openrouter" | "local";

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AppConfig {
  ai?: AISettings | null;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  local: "llama3",
  openai: "gpt-4.1",
  openrouter: "anthropic/claude-sonnet-4",
};

export const getDefaultModel = (provider: AIProvider): string =>
  DEFAULT_MODELS[provider];

export const getAISettings = async (): Promise<AISettings | null> => {
  const config = (await getConfig()) as AppConfig;
  return config.ai ?? null;
};

export const saveAISettings = async (settings: AISettings): Promise<void> => {
  const config = (await getConfig()) as AppConfig;
  const normalized = normalizeAISettingsDraft({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl ?? "",
    model: settings.model ?? "",
    provider: settings.provider,
  });
  await saveConfig({ ...config, ai: normalized });
};

export const hasAISettings = async (): Promise<boolean> => {
  const settings = await getAISettings();
  return isAISettingsConfigured(settings);
};
