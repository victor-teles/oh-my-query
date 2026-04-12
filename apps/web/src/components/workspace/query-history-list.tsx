import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useQueryHistory } from "@/hooks/use-query-history";
import { cn } from "@/lib/utils";

const FILTER_MIN_ITEMS = 6;

const normalizeSql = (sql: string): string =>
  sql.replaceAll(/\s+/g, " ").trim();

const truncateSql = (sql: string, maxLength = 50): string => {
  const oneLine = normalizeSql(sql);
  if (oneLine.length <= maxLength) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLength)}...`;
};

const getDateLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d, yyyy");
};

interface DateGroup {
  label: string;
  entries: HistoryEntry[];
}

const groupByDate = (entries: HistoryEntry[]): DateGroup[] => {
  const groups: DateGroup[] = [];
  let currentLabel = "";
  for (const entry of entries) {
    const label = getDateLabel(entry.timestamp);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ entries: [entry], label });
    } else {
      groups.at(-1)?.entries.push(entry);
    }
  }
  return groups;
};

const SKELETON_ITEMS = [0, 1, 2, 3, 4];

interface QueryHistoryListProps {
  connectionId: string;
}

export const QueryHistoryList = ({ connectionId }: QueryHistoryListProps) => {
  const { entries, error, isLoading, refresh } = useQueryHistory(connectionId);
  const [filter, setFilter] = useState("");
  const [showSuccess, setShowSuccess] = useState(true);
  const [showFailure, setShowFailure] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value);
    },
    []
  );

  const handleFilterKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (filter) {
          setFilter("");
        } else {
          (e.target as HTMLInputElement).blur();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const firstButton = listRef.current?.querySelector<HTMLButtonElement>(
          'button[role="listitem"]'
        );
        firstButton?.focus();
      }
    },
    [filter]
  );

  const toggleSuccess = useCallback(() => {
    setShowSuccess((prev) => {
      if (prev && !showFailure) {
        return prev;
      }
      return !prev;
    });
  }, [showFailure]);

  const toggleFailure = useCallback(() => {
    setShowFailure((prev) => {
      if (prev && !showSuccess) {
        return prev;
      }
      return !prev;
    });
  }, [showSuccess]);

  const filteredEntries = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    return entries.filter((entry) => {
      if (!showSuccess && entry.success) {
        return false;
      }
      if (!showFailure && !entry.success) {
        return false;
      }
      if (lowerFilter && !entry.sql.toLowerCase().includes(lowerFilter)) {
        return false;
      }
      return true;
    });
  }, [entries, filter, showSuccess, showFailure]);

  const dateGroups = useMemo(
    () => groupByDate(filteredEntries),
    [filteredEntries]
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        return;
      }

      const items = listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="listitem"]'
      );
      if (!items?.length) {
        return;
      }

      const focused = document.activeElement as HTMLElement;
      const index = [...items].indexOf(focused as HTMLButtonElement);
      if (index === -1) {
        return;
      }

      e.preventDefault();
      if (e.key === "ArrowUp") {
        if (index === 0) {
          inputRef.current?.focus();
        } else {
          items[index - 1]?.focus();
        }
      } else {
        items[Math.min(index + 1, items.length - 1)]?.focus();
      }
    },
    []
  );

  if (isLoading) {
    return (
      <div className="space-y-2 px-3 py-2">
        {SKELETON_ITEMS.map((id) => (
          <Skeleton key={id} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>Failed to load history</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="size-3" />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No history yet</EmptyTitle>
            <EmptyDescription>Run a query to see it here</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const showFilter = entries.length >= FILTER_MIN_ITEMS;

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <div className="px-2 py-2">
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>
                <Search />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              ref={inputRef}
              value={filter}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
              placeholder="Filter history..."
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={toggleSuccess}
                      aria-label="Show successful queries"
                      aria-pressed={showSuccess}
                      className={cn(
                        "rounded p-0.5 transition-colors",
                        showSuccess
                          ? "text-emerald-500 hover:text-emerald-400"
                          : "text-muted-foreground/40 hover:text-muted-foreground"
                      )}
                    />
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Show successful queries</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={toggleFailure}
                      aria-label="Show failed queries"
                      aria-pressed={showFailure}
                      className={cn(
                        "rounded p-0.5 transition-colors",
                        showFailure
                          ? "text-destructive hover:text-destructive/80"
                          : "text-muted-foreground/40 hover:text-muted-foreground"
                      )}
                    />
                  }
                >
                  <XCircle className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Show failed queries</TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {filteredEntries.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No matching queries
          </p>
        ) : (
          <div
            ref={listRef}
            role="list"
            className="flex flex-col px-2 py-1"
            onKeyDown={handleListKeyDown}
          >
            {dateGroups.map((group, i) => (
              <div
                key={group.label}
                className={cn("flex flex-col gap-0.5", i > 0 && "mt-2")}
              >
                <div
                  role="separator"
                  className="sticky top-0 z-10 bg-sidebar px-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {group.label}
                </div>
                {group.entries.map((entry) => (
                  <HistoryItem key={entry.timestamp} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface HistoryItemProps {
  entry: HistoryEntry;
}

const HistoryItem = memo(function HistoryItem({ entry }: HistoryItemProps) {
  const { openQuery } = useEditorInsert();

  const handleClick = useCallback(() => {
    openQuery(entry.sql);
  }, [openQuery, entry.sql]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            role="listitem"
            onClick={handleClick}
            aria-label={`Open query in new tab: ${truncateSql(entry.sql, 50)}`}
            className={cn(
              "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left",
              "hover:bg-accent/50 transition-[color,background-color,transform] duration-100",
              "motion-safe:active:scale-[0.98]",
              "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            )}
          />
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {entry.success ? (
              <CheckCircle2 className="size-3 text-emerald-500" />
            ) : (
              <XCircle className="size-3 text-destructive" />
            )}
            <span className="tabular-nums">{entry.executionTimeMs}ms</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-2.5" />
            <span>
              {formatDistanceToNow(new Date(entry.timestamp), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        <p className="line-clamp-2 text-xs font-mono text-foreground">
          {normalizeSql(entry.sql)}
        </p>
        {!entry.success && entry.error && (
          <p className="line-clamp-1 text-[10px] text-destructive">
            {entry.error}
          </p>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-80">
        <pre className="whitespace-pre-wrap text-xs">{entry.sql}</pre>
        {!entry.success && entry.error && (
          <p className="mt-2 border-t border-destructive/20 pt-2 text-xs text-destructive">
            {entry.error}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
