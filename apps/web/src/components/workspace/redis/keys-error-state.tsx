import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface KeysErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const KeysErrorState = ({ message, onRetry }: KeysErrorStateProps) => (
  <div className="flex flex-col items-start gap-2 px-4 py-6 text-left">
    <AlertCircle className="size-5 text-destructive" />
    <p className="text-sm font-medium text-foreground">
      Couldn&apos;t scan keyspace
    </p>
    <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
    <Button
      className="mt-1 h-6 px-2 text-[11px]"
      onClick={onRetry}
      size="sm"
      variant="outline"
    >
      <RefreshCw className="mr-1 size-3" />
      Retry
    </Button>
  </div>
);
