import type { ChangeEvent, FormEvent } from "react";

import { AI_PROVIDER_INFO } from "@oh-my-query/rpc";
import { RotateCwIcon } from "lucide-react";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";

import { AiFormActions } from "./ai-form-actions";
import { AiKeyField } from "./ai-key-field";
import { keyMask } from "./ai-settings-draft";
import { AiTestResult } from "./ai-test-result";
import { ModelField } from "./model-field";
import { ProviderSelect } from "./provider-select";
import { SettingRow } from "./setting-row";
import { SettingsInput } from "./settings-input";
import { useAiSettingsForm } from "./use-ai-settings-form";

function AiSettingsFailure({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Reveal className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="type-meta text-danger-ink" role="alert">
        {message}
      </span>
      <Pressable
        className="flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground"
        onClick={onRetry}
      >
        <RotateCwIcon aria-hidden className="size-3" />
        Retry
      </Pressable>
    </Reveal>
  );
}

export function AiSettingsSection() {
  const form = useAiSettingsForm();
  const { phase, draft, saved, test } = form.state;
  const {
    clearKey: handleClearKey,
    edit,
    retry: handleRetry,
    save,
    setProvider: handleProvider,
    test: handleTest,
  } = form;
  const info = AI_PROVIDER_INFO[draft.provider];
  const keepable = saved?.provider === draft.provider && saved.hasKey;

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      save();
    },
    [save]
  );
  const handleModel = useCallback((model: string) => edit({ model }), [edit]);
  const handleKey = useCallback(
    (apiKey: string | null) => edit({ apiKey }),
    [edit]
  );
  const handleBaseUrl = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      edit({ baseUrl: event.target.value }),
    [edit]
  );

  if (phase.status === "loading") {
    return (
      <div
        aria-label="Loading AI settings"
        className="h-14 animate-pulse bg-row-hover/40 motion-reduce:animate-none"
        role="status"
      />
    );
  }
  if (phase.status === "load-failed") {
    return <AiSettingsFailure message={phase.message} onRetry={handleRetry} />;
  }

  return (
    <form aria-label="AI provider" onSubmit={handleSubmit}>
      <SettingRow
        description="Answers questions about your data."
        label="Provider"
      >
        <ProviderSelect onChange={handleProvider} value={draft.provider} />
      </SettingRow>
      <SettingRow description="Any model your provider serves." label="Model">
        <ModelField
          onChange={handleModel}
          provider={draft.provider}
          value={draft.model}
        />
      </SettingRow>
      {info.baseUrl === "required" ? (
        <SettingRow
          description="An OpenAI-compatible endpoint."
          label="Base URL"
        >
          <SettingsInput
            aria-label="Base URL"
            onChange={handleBaseUrl}
            placeholder={info.defaultBaseUrl ?? "http://localhost:11434/v1"}
            value={draft.baseUrl}
          />
        </SettingRow>
      ) : null}
      {info.needsKey ? (
        <SettingRow
          description="Encrypted on this Mac. Never shown again."
          label="API key"
        >
          <AiKeyField
            mask={keepable ? keyMask(saved) : null}
            onChange={handleKey}
            onClear={handleClearKey}
            value={draft.apiKey}
          />
        </SettingRow>
      ) : null}
      <AiFormActions
        dirty={form.dirty}
        onTest={handleTest}
        phase={phase}
        testing={test.status === "testing"}
      />
      <AiTestResult test={test} />
    </form>
  );
}
