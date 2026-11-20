import type { AiProvider } from "@oh-my-query/rpc";

import { AI_PROVIDER_INFO, AI_PROVIDERS, isAiProvider } from "@oh-my-query/rpc";
import { useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS = AI_PROVIDERS.map((provider) => ({
  label: AI_PROVIDER_INFO[provider].label,
  value: provider,
}));

interface ProviderSelectProps {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
}

export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  const handleChange = useCallback(
    (next: string | null) => {
      if (next && isAiProvider(next)) {
        onChange(next);
      }
    },
    [onChange]
  );

  return (
    <Select items={ITEMS} onValueChange={handleChange} value={value}>
      <SelectTrigger
        aria-label="Provider"
        className="h-7 w-60 rounded-[8px] border-panel-border bg-row-hover type-meta"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
