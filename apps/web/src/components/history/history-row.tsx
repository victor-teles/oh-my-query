import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ClockIcon, DatabaseIcon, XCircle } from "lucide-react";
import { memo, useCallback } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { isKnownDialect, normalizeSql } from "@/lib/history-shared";
import { cn } from "@/lib/utils";

interface HistoryRowProps {
  entry: HistoryEntry;
  connectionName: string | null;
  focused: boolean;
  selected: boolean;
  onFocus: (entry: HistoryEntry) => void;
  onOpen: (entry: HistoryEntry) => void;
}

export const HistoryRow = memo(function HistoryRow({
  entry,
  connectionName,
  focused,
  selected,
  onFocus,
  onOpen,
}: HistoryRowProps) {
  const handleClick = useCallback(() => {
    onFocus(entry);
  }, [entry, onFocus]);

  const handleDoubleClick = useCallback(() => {
    onOpen(entry);
  }, [entry, onOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onOpen(entry);
      }
    },
    [entry, onOpen]
  );

  const DialectIcon = isKnownDialect(entry.dialect)
    ? DATABASE_ICON_MAP[entry.dialect]
    : null;

  const connectionLabel = connectionName ?? "Deleted connection";

  return (
    <button
      aria-label={`Query from ${connectionLabel}: ${normalizeSql(entry.sql).slice(0, 80)}`}
      aria-selected={selected}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left",
        "outline-none transition-[background-color,color] duration-100",
        "hover:bg-accent/40",
        focused &&
          "ring-1 ring-primary/60 ring-inset bg-primary/[0.06] motion-safe:animate-in motion-safe:fade-in-0",
        selected && "bg-primary/10",
        !focused && !selected && "bg-transparent",
        !connectionName && "text-muted-foreground/60"
      )}
      data-focused={focused || undefined}
      data-selected={selected || undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="option"
      tabIndex={focused ? 0 : -1}
      type="button"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {entry.success ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="size-3 shrink-0 text-destructive" />
          )}
          {DialectIcon ? (
            <DialectIcon className="size-3 shrink-0 text-muted-foreground/80" />
          ) : (
            <DatabaseIcon className="size-3 shrink-0 text-muted-foreground/80" />
          )}
          <span className="truncate">{connectionLabel}</span>
          {entry.database && (
            <span className="shrink-0 text-muted-foreground/60">
              · {entry.database}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums">{entry.executionTimeMs}ms</span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-2.5" />
            {formatDistanceToNow(new Date(entry.timestamp), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 font-mono text-xs text-foreground">
        {normalizeSql(entry.sql)}
      </p>
      {!entry.success && entry.error && (
        <p className="line-clamp-1 text-[10px] text-destructive">
          {entry.error}
        </p>
      )}
    </button>
  );
});
