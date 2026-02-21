import { Settings } from "lucide-react";
import { useCallback, useState } from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  onOpenSettings?: () => void;
  isStreaming: boolean;
  isConfigured: boolean;
}

export const ChatInput = ({
  onSend,
  onStop,
  onOpenSettings,
  isStreaming,
  isConfigured,
}: ChatInputProps) => {
  const [value, setValue] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text?.trim();
      if (!text) {
        return;
      }
      onSend(text);
      setValue("");
    },
    [onSend]
  );

  if (!isConfigured) {
    return (
      <div className="border-t p-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Settings className="size-4" />
          Configure an AI provider to get started
        </button>
      </div>
    );
  }

  return (
    <div className="border-t p-3">
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={value}
            onChange={handleChange}
            placeholder="Ask about your database..."
            className="min-h-11"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputButton onClick={onOpenSettings} tooltip="AI Settings">
              <Settings className="size-4" />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit
            status={isStreaming ? "streaming" : "ready"}
            disabled={!value.trim() && !isStreaming}
            onStop={onStop}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};
