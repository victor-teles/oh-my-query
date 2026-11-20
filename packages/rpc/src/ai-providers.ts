export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "local",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiProviderInfo {
  label: string;
  defaultModel: string | null;
  suggestedModels: readonly string[];
  needsKey: boolean;
  baseUrl: "required" | "none";
  defaultBaseUrl: string | null;
}

export const AI_PROVIDER_INFO: Record<AiProvider, AiProviderInfo> = {
  anthropic: {
    baseUrl: "none",
    defaultBaseUrl: null,
    defaultModel: "claude-opus-5-5",
    label: "Anthropic",
    needsKey: true,
    suggestedModels: [
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
    ],
  },
  google: {
    baseUrl: "none",
    defaultBaseUrl: null,
    defaultModel: "gemini-2.5-pro",
    label: "Google",
    needsKey: true,
    suggestedModels: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-3.1-pro-preview",
    ],
  },
  local: {
    baseUrl: "required",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3",
    label: "Local (OpenAI-compatible)",
    needsKey: false,
    suggestedModels: ["llama3", "qwen2.5-coder"],
  },
  openai: {
    baseUrl: "none",
    defaultBaseUrl: null,
    defaultModel: "gpt-5.2",
    label: "OpenAI",
    needsKey: true,
    suggestedModels: ["gpt-5.2", "gpt-5-mini", "gpt-4.1"],
  },
  openrouter: {
    baseUrl: "none",
    defaultBaseUrl: null,
    defaultModel: null,
    label: "OpenRouter",
    needsKey: true,
    suggestedModels: [],
  },
};

export const isAiProvider = (value: string): value is AiProvider =>
  (AI_PROVIDERS as readonly string[]).includes(value);

export interface RedactedAiSettings {
  provider: AiProvider;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
  keyHint: string | null;
}

export interface AiSettingsInput {
  provider: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AiTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface ActiveConnection {
  connectionId: string;
  database: string | null;
}

export const isAiConfigured = (
  settings: RedactedAiSettings | null
): boolean => {
  if (!settings) {
    return false;
  }
  const info = AI_PROVIDER_INFO[settings.provider];
  const hasModel = Boolean(settings.model ?? info.defaultModel);
  return hasModel && (settings.hasKey || !info.needsKey);
};
