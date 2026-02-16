import { isTauri } from "@/lib/tauri";

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
  anthropic: "claude-sonnet-4-5-20250929",
  local: "llama3",
  openai: "gpt-4o",
  openrouter: "anthropic/claude-sonnet-4-5",
};

export const getDefaultModel = (provider: AIProvider): string =>
  DEFAULT_MODELS[provider];

export const getAISettings = async (): Promise<AISettings | null> => {
  if (!isTauri()) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const config = await invoke<AppConfig>("get_config");
  return config.ai ?? null;
};

export const saveAISettings = async (settings: AISettings): Promise<void> => {
  if (!isTauri()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const config = await invoke<AppConfig>("get_config");
  await invoke("save_config", {
    config: { ...config, ai: settings },
  });
};

export const hasAISettings = async (): Promise<boolean> => {
  const settings = await getAISettings();
  return settings !== null && settings.apiKey.length > 0;
};
