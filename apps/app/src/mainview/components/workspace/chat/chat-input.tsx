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
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  onOpenSettings?: () => void;
  isStreaming: boolean;
  isConfigured: boolean | null;
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

  const submitDisabled =
    isConfigured !== true || (!value.trim() && !isStreaming);

  return (
    <div className="border-t p-3">
      {isConfigured === false && (
        <div
          className="
            mb-2 flex items-center justify-between gap-2 rounded-md border
            border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground
          "
        >
          <span>Connect an AI provider to start chatting.</span>
          <Button onClick={onOpenSettings} size="sm" variant="outline">
            <Settings />
            Configure
          </Button>
        </div>
      )}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-7"
            disabled={isConfigured !== true}
            onChange={handleChange}
            placeholder="Ask about your database..."
            value={value}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputButton onClick={onOpenSettings} tooltip="AI Settings">
              <Settings className="size-4" />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={submitDisabled}
            onStop={onStop}
            status={isStreaming ? "streaming" : "ready"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};
