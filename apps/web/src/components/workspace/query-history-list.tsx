import { CheckCircle2, Clock, History, XCircle } from "lucide-react";
import { memo, useCallback } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

const formatRelativeTime = (timestamp: string): string => {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < SECONDS_PER_MINUTE) {
    return "just now";
  }
  if (seconds < SECONDS_PER_HOUR) {
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    return `${minutes}m ago`;
  }
  if (seconds < SECONDS_PER_DAY) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    return `${hours}h ago`;
  }
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  return `${days}d ago`;
};

const MAX_SQL_DISPLAY_LENGTH = 120;

const truncateSql = (
  sql: string,
  maxLength = MAX_SQL_DISPLAY_LENGTH
): string => {
  const oneLine = sql.replaceAll(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLength)}...`;
};

const SKELETON_ITEMS = ["h1", "h2", "h3", "h4", "h5"];

interface QueryHistoryListProps {
  connectionId: string;
}

export const QueryHistoryList = ({ connectionId }: QueryHistoryListProps) => {
  const { entries, isLoading } = useQueryHistory(connectionId);

  if (isLoading) {
    return (
      <div className="space-y-2 px-3 py-2">
        {SKELETON_ITEMS.map((id) => (
          <Skeleton key={id} className="h-12 w-full" />
        ))}
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

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 px-2 py-1">
        {entries.map((entry) => (
          <HistoryItem key={entry.timestamp} entry={entry} />
        ))}
      </div>
    </ScrollArea>
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
            onClick={handleClick}
            className={cn(
              "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left",
              "hover:bg-accent/50 transition-colors"
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
            <span>{entry.executionTimeMs}ms</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-2.5" />
            <span>{formatRelativeTime(entry.timestamp)}</span>
          </div>
        </div>
        <p className="line-clamp-2 text-xs font-mono text-foreground/80">
          {truncateSql(entry.sql)}
        </p>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-80">
        <pre className="whitespace-pre-wrap text-xs">{entry.sql}</pre>
      </TooltipContent>
    </Tooltip>
  );
});
