import { AlertCircle, RefreshCw, Settings, X } from "lucide-react";

import type { AIError } from "@/lib/ai-errors";

import { Button } from "@/components/ui/button";

interface ChatErrorProps {
  error: AIError;
  onRetry: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export const ChatError = ({
  error,
  onRetry,
  onOpenSettings,
  onDismiss,
}: ChatErrorProps) => {
  const showSettings =
    error.type === "auth" || error.type === "model_not_found";

  return (
    <div className="mx-3 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{error.message}</p>
          <p className="text-xs text-muted-foreground">{error.suggestion}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X className="size-3" />
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {error.retryable && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3" />
            Retry
          </Button>
        )}
        {showSettings && (
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            <Settings className="size-3" />
            Open Settings
          </Button>
        )}
      </div>
    </div>
  );
};
