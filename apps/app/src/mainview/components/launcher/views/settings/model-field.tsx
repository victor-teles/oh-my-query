import type { AiProvider } from "@conch/rpc";
import type { ChangeEvent } from "react";

import { AI_PROVIDER_INFO } from "@conch/rpc";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { cn } from "@/lib/utils";

import { SettingsInput } from "./settings-input";

interface SuggestionProps {
  model: string;
  active: boolean;
  onPick: (model: string) => void;
}

function Suggestion({ model, active, onPick }: SuggestionProps) {
  const handleClick = useCallback(() => onPick(model), [model, onPick]);
  return (
    <Pressable
      aria-pressed={active}
      className={cn(
        "h-6 rounded-[6px] px-2 font-mono text-[11px]",
        active
          ? "bg-row-active text-foreground"
          : "text-panel-muted hover:bg-row-hover hover:text-foreground"
      )}
      onClick={handleClick}
    >
      {model}
    </Pressable>
  );
}

interface ModelFieldProps {
  provider: AiProvider;
  value: string;
  onChange: (model: string) => void;
}

export function ModelField({ provider, value, onChange }: ModelFieldProps) {
  const info = AI_PROVIDER_INFO[provider];
  const effective = value.trim() || info.defaultModel;
  const handleInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange]
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <SettingsInput
        aria-label="Model"
        onChange={handleInput}
        placeholder={
          info.defaultModel ? `${info.defaultModel} (default)` : "vendor/model"
        }
        value={value}
      />
      {info.suggestedModels.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-0.5">
          {info.suggestedModels.map((model) => (
            <Suggestion
              active={model === effective}
              key={model}
              model={model}
              onPick={onChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
