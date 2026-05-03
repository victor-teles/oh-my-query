import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Link2Off,
  Lock,
  RefreshCw,
  RotateCw,
  SearchX,
  ShieldAlert,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { ErrorLocation } from "@/lib/error-location";
import type { ErrorCategory } from "@/lib/query-error";

import { Button } from "@/components/ui/button";
import { formatLocationLabel, parseErrorLocation } from "@/lib/error-location";
import { classifyError } from "@/lib/query-error";

interface QueryErrorDisplayProps {
  error: string;
  errorCode?: string | null;
  sql?: string | null;
  onAiFix?: () => void;
  onJumpToLine?: (location: ErrorLocation) => void;
  onReconnect?: () => void;
  onRetry?: () => void;
}

const buildCopyText = (error: string, sql: string | null | undefined): string =>
  sql?.trim() ? `Error: ${error}\n\n-- Query:\n${sql}` : `Error: ${error}`;

const CATEGORY_ICONS: Record<ErrorCategory, typeof AlertCircle> = {
  connection: Link2Off,
  constraint: ShieldAlert,
  "not-found": SearchX,
  permission: Lock,
  syntax: TriangleAlert,
  timeout: Clock,
  unknown: AlertCircle,
};

type PrimaryAction = "jump" | "reconnect" | "retry" | "none";

const resolvePrimaryAction = ({
  canJump,
  category,
  hasReconnect,
  hasRetry,
}: {
  canJump: boolean;
  category: ErrorCategory;
  hasReconnect: boolean;
  hasRetry: boolean;
}): PrimaryAction => {
  if (category === "syntax" && canJump) {
    return "jump";
  }
  if (category === "connection" && hasReconnect) {
    return "reconnect";
  }
  if (hasRetry) {
    return "retry";
  }
  if (canJump) {
    return "jump";
  }
  if (hasReconnect) {
    return "reconnect";
  }
  return "none";
};

export const QueryErrorDisplay = ({
  error,
  errorCode,
  sql,
  onAiFix,
  onJumpToLine,
  onReconnect,
  onRetry,
}: QueryErrorDisplayProps) => {
  const location = useMemo(() => parseErrorLocation(error), [error]);
  const classification = useMemo(
    () => classifyError(error, errorCode ?? null),
    [error, errorCode]
  );
  const canJump = location !== null && onJumpToLine !== undefined;
  const jumpLabel = location ? `Jump to ${formatLocationLabel(location)}` : "";

  const CategoryIcon = CATEGORY_ICONS[classification.category];

  const primaryAction = resolvePrimaryAction({
    canJump,
    category: classification.category,
    hasReconnect: onReconnect !== undefined,
    hasRetry: onRetry !== undefined,
  });
  const variantFor = (action: PrimaryAction) =>
    action === primaryAction ? "default" : "ghost";

  const handleJump = useCallback(() => {
    if (location && onJumpToLine) {
      onJumpToLine(location);
    }
  }, [location, onJumpToLine]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(buildCopyText(error, sql));
  }, [error, sql]);

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <CategoryIcon className="size-4" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                {classification.label}
              </span>
            </span>
            {location && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatLocationLabel(location)}
              </span>
            )}
            {errorCode &&
              errorCode !== "DB_ERROR" &&
              errorCode !== "UNKNOWN_ERROR" && (
                <span
                  className="
                    rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px]
                    text-muted-foreground
                  "
                >
                  {errorCode}
                </span>
              )}
          </div>
          <p className="text-sm/relaxed text-foreground">
            {classification.summary}
          </p>
          <p className="text-xs text-muted-foreground">{classification.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canJump && location && (
            <Button
              aria-label={jumpLabel}
              onClick={handleJump}
              size="sm"
              title={jumpLabel}
              variant={variantFor("jump")}
            >
              <ArrowRight />
              Jump to line
            </Button>
          )}
          {classification.category === "connection" && onReconnect && (
            <Button
              aria-label="Reconnect"
              onClick={onReconnect}
              size="sm"
              title="Reconnect"
              variant={variantFor("reconnect")}
            >
              <RefreshCw />
              Reconnect
            </Button>
          )}
          {onRetry && (
            <Button
              aria-label="Retry"
              onClick={onRetry}
              size="sm"
              title="Retry"
              variant={variantFor("retry")}
            >
              <RotateCw />
              Retry
            </Button>
          )}
          {onAiFix && (
            <Button
              aria-label="Fix with AI"
              onClick={onAiFix}
              size="sm"
              title="Fix with AI"
              variant="ghost"
            >
              <Terminal />
              Fix with AI
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

      <CollapsibleDetails error={error} sql={sql} />
    </div>
  );
};

const CollapsibleDetails = ({
  error,
  sql,
}: {
  error: string;
  sql?: string | null;
}) => {
  const [open, setOpen] = useState(true);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const hasDetails = error.length > 0;

  if (!hasDetails && !sql?.trim()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="
          inline-flex w-fit items-center gap-1 text-[10px] font-medium
          tracking-wider text-muted-foreground uppercase transition-colors
          hover:text-foreground
        "
        onClick={toggle}
        type="button"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        Details
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          <pre
            className="
              max-h-64 overflow-auto rounded-md border border-destructive/30
              bg-destructive/5 p-3 font-mono text-xs/relaxed wrap-break-word
              whitespace-pre-wrap text-foreground
            "
          >
            {error}
          </pre>
          {sql?.trim() && (
            <pre
              className="
                max-h-48 overflow-auto rounded-md border border-border/60
                bg-muted/30 p-3 font-mono text-xs/relaxed wrap-break-word
                whitespace-pre-wrap text-muted-foreground
              "
            >
              {sql}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
