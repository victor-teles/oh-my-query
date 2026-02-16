import { Send, Settings, Square } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
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
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your database..."
          className="max-h-[200px] min-h-[44px] flex-1 resize-none"
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={onStop}
                  aria-label="Stop generating"
                />
              }
            >
              <Square className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Stop generating</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!value.trim()}
                  aria-label="Send message"
                />
              }
            >
              <Send className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
