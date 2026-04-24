import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AIProvider } from "@/lib/ai-settings";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAISettings,
  getDefaultModel,
  saveAISettings,
} from "@/lib/ai-settings";
import {
  canSaveAISettingsDraft,
  normalizeAISettingsDraft,
} from "@/lib/ai-settings-form";
import { openExternal } from "@/lib/open-external";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProviderInfo {
  value: AIProvider;
  label: string;
  description: string;
  keyUrl?: string;
  keyUrlLabel?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    description: "GPT-4.1 and other OpenAI models",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "platform.openai.com",
    label: "OpenAI",
    value: "openai",
  },
  {
    description: "Claude models from Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyUrlLabel: "console.anthropic.com",
    label: "Anthropic",
    value: "anthropic",
  },
  {
    description: "Access multiple providers through one API",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "openrouter.ai",
    label: "OpenRouter",
    value: "openrouter",
  },
  {
    description: "Ollama and OpenAI-compatible local servers",
    label: "Local",
    value: "local",
  },
];

export const AISettingsDialog = ({
  open,
  onOpenChange,
}: AISettingsDialogProps) => {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const load = async () => {
      const settings = await getAISettings();
      if (settings) {
        setProvider(settings.provider);
        setApiKey(settings.apiKey);
        setModel(settings.model ?? "");
        setBaseUrl(settings.baseUrl ?? "");
      }
    };

    load();
  }, [open]);

  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  const handleProviderChange = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      const p = value as AIProvider;
      setProvider(p);
      if (!model || model === getDefaultModel(provider)) {
        setModel(getDefaultModel(p));
      }
    },
    [model, provider]
  );

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value);
    },
    []
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setModel(e.target.value);
    },
    []
  );

  const handleBaseUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBaseUrl(e.target.value);
    },
    []
  );

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenKeyUrl = useCallback(async () => {
    if (currentProvider?.keyUrl) {
      await openExternal(currentProvider.keyUrl);
    }
  }, [currentProvider?.keyUrl]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const settings = normalizeAISettingsDraft({
        apiKey,
        baseUrl,
        model,
        provider,
      });
      await saveAISettings(settings);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [provider, apiKey, model, baseUrl, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider for the query assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full" id="ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentProvider && (
              <p className="text-xs text-muted-foreground">
                {currentProvider.description}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={
                provider === "local"
                  ? "Optional for local models"
                  : "Enter your API key"
              }
            />
            {currentProvider?.keyUrl && (
              <p className="text-xs text-muted-foreground">
                Get your key at{" "}
                <button
                  type="button"
                  onClick={handleOpenKeyUrl}
                  className="text-primary underline underline-offset-2 cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
                >
                  {currentProvider.keyUrlLabel}
                </button>
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-model">Model</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={handleModelChange}
              placeholder={getDefaultModel(provider)}
            />
          </div>

          {provider === "local" && (
            <div className="grid gap-2">
              <Label htmlFor="ai-base-url">Base URL</Label>
              <Input
                id="ai-base-url"
                value={baseUrl}
                onChange={handleBaseUrlChange}
                placeholder="http://localhost:11434/v1"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !canSaveAISettingsDraft({ apiKey, baseUrl, model, provider })
            }
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
