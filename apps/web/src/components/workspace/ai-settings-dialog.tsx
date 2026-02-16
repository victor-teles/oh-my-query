import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AIProvider, AISettings } from "@/lib/ai-settings";

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

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Local (OpenAI-compatible)", value: "local" },
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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const settings: AISettings = {
        apiKey,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
        provider,
      };
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
            disabled={saving || (!apiKey && provider !== "local")}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
