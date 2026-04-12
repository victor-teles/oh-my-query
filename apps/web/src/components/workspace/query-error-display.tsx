import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ErrorLocation } from "@/lib/error-location";

import { Button } from "@/components/ui/button";
import { formatLocationLabel, parseErrorLocation } from "@/lib/error-location";

interface QueryErrorDisplayProps {
  error: string;
  sql?: string | null;
  onJumpToLine?: (location: ErrorLocation) => void;
  onReconnect?: () => void;
  onRetry?: () => void;
}

const buildCopyText = (error: string, sql: string | null | undefined): string =>
  sql?.trim() ? `Error: ${error}\n\n-- Query:\n${sql}` : `Error: ${error}`;

export const QueryErrorDisplay = ({
  error,
  sql,
  onJumpToLine,
  onReconnect,
  onRetry,
}: QueryErrorDisplayProps) => {
  const location = useMemo(() => parseErrorLocation(error), [error]);
  const canJump = location !== null && onJumpToLine !== undefined;
  const jumpLabel = location ? `Jump to ${formatLocationLabel(location)}` : "";

  const handleJump = useCallback(() => {
    if (location && onJumpToLine) {
      onJumpToLine(location);
    }
  }, [location, onJumpToLine]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(error, sql));
      toast.success("Copied error to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }, [error, sql]);

  return (
    <div className="flex w-full flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <AlertCircle className="size-3.5" />
            <span className="font-medium text-[11px] uppercase tracking-wider">
              Error
            </span>
          </span>
          {location && (
            <span className="font-mono text-muted-foreground text-xs">
              {formatLocationLabel(location)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canJump && location && (
            <Button
              aria-label={jumpLabel}
              onClick={handleJump}
              size="sm"
              title={jumpLabel}
            >
              <ArrowRight />
              Jump to line
            </Button>
          )}
          {onRetry && (
            <Button
              aria-label="Retry"
              onClick={onRetry}
              size="sm"
              title="Retry"
              variant="outline"
            >
              <RotateCw />
              Retry
            </Button>
          )}
          {onReconnect && (
            <Button
              aria-label="Reconnect"
              onClick={onReconnect}
              size="sm"
              title="Reconnect"
              variant="outline"
            >
              <RefreshCw />
              Reconnect
            </Button>
          )}
          <Button
            aria-label="Copy error"
            onClick={handleCopy}
            size="sm"
            title="Copy error"
            variant="ghost"
          >
            <Copy />
          </Button>
        </div>
      </div>

      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 font-mono text-foreground text-xs leading-relaxed">
        {error}
      </pre>

      {sql?.trim() && <SqlPreview sql={sql} />}
    </div>
  );
};

const SqlPreview = ({ sql }: { sql: string }) => {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        className="inline-flex w-fit items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground"
        onClick={toggle}
        type="button"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        Query
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-muted-foreground text-xs leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  );
};
