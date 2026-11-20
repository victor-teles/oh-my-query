import type {
  AiProvider,
  AiSettingsInput,
  RedactedAiSettings,
} from "@oh-my-query/rpc";

import { AI_PROVIDER_INFO } from "@oh-my-query/rpc";

export interface AiDraft {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  // null keeps the stored key; a string replaces it.
  apiKey: string | null;
}

const DEFAULT_PROVIDER: AiProvider = "anthropic";

const defaultBaseUrl = (provider: AiProvider) =>
  AI_PROVIDER_INFO[provider].defaultBaseUrl ?? "";

export const draftFromSettings = (
  settings: RedactedAiSettings | null
): AiDraft => {
  const provider = settings?.provider ?? DEFAULT_PROVIDER;
  return {
    apiKey: settings?.hasKey ? null : "",
    baseUrl: settings?.baseUrl ?? defaultBaseUrl(provider),
    model: settings?.model ?? "",
    provider,
  };
};

// A stored key belongs to its provider, so switching providers starts a new one.
export const switchProvider = (
  draft: AiDraft,
  provider: AiProvider,
  saved: RedactedAiSettings | null
): AiDraft => {
  const returning = saved?.provider === provider;
  return {
    apiKey: returning && saved.hasKey ? null : "",
    baseUrl: returning ? (saved.baseUrl ?? "") : defaultBaseUrl(provider),
    model: returning ? (saved.model ?? "") : "",
    provider,
  };
};

export const draftToInput = (draft: AiDraft): AiSettingsInput => {
  const needsBaseUrl = AI_PROVIDER_INFO[draft.provider].baseUrl === "required";
  const key = draft.apiKey?.trim();
  return {
    apiKey: key || undefined,
    baseUrl: needsBaseUrl ? draft.baseUrl.trim() || undefined : undefined,
    model: draft.model.trim() || undefined,
    provider: draft.provider,
  };
};

export const isDraftDirty = (
  draft: AiDraft,
  saved: RedactedAiSettings | null
): boolean => {
  const baseline = draftFromSettings(saved);
  return (
    !saved ||
    draft.provider !== baseline.provider ||
    draft.model.trim() !== baseline.model ||
    draft.baseUrl.trim() !== baseline.baseUrl ||
    Boolean(draft.apiKey?.trim())
  );
};

export const keyMask = (settings: RedactedAiSettings): string =>
  settings.keyHint ? `•••• ${settings.keyHint}` : "••••••••";
