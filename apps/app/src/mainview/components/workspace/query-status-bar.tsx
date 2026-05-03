import { Download, FileCode } from "lucide-react";

import type { ExecuteResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCount, formatDuration } from "@/lib/format-metrics";

interface QueryStatusBarProps {
  result: ExecuteResult;
  executedSql?: string | null;
  onDownloadCsv?: () => void;
}

const getLabel = (resultType: string, count: number): string => {
  if (resultType === "documents") {
    return count === 1 ? "document" : "documents";
  }
  return count === 1 ? "row" : "rows";
};

export const QueryStatusBar = ({
  result,
  executedSql,
  onDownloadCsv,
}: QueryStatusBarProps) => {
  const count =
    result.resultType === "tabular" ? result.rowCount : result.count;
  const label = getLabel(result.resultType, count);
  const hasSql = Boolean(executedSql?.trim());

  return (
    <div
      aria-live="polite"
      className="
        text-data flex items-center gap-3 border-t bg-muted/30 px-3 py-1 text-xs
        text-foreground
      "
      role="status"
    >
      <span>
        <span className="font-medium">{formatCount(count)}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="text-muted-foreground">
        {formatDuration(result.executionTimeMs)}
      </span>
      {result.isTruncated && (
        <span className="font-medium text-primary">Result truncated</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {hasSql && executedSql && (
          <HoverCard>
            <HoverCardTrigger
              render={
                <button
                  className="
                    inline-flex items-center gap-1 rounded-sm border
                    border-border/70 bg-background/50 px-1.5 py-0.5 font-sans
                    text-[11px] text-foreground transition-colors
                    hover:border-border hover:bg-accent
                  "
                  type="button"
                >
                  <FileCode className="size-3 text-muted-foreground" />
                  Query
                </button>
              }
            />
            <HoverCardContent
              align="end"
              className="w-[min(32rem,calc(100vw-2rem))] p-0"
            >
              <pre
                className="
                  max-h-64 overflow-auto rounded-lg p-3 font-mono text-[11px]
                  leading-relaxed wrap-break-word whitespace-pre-wrap
                  text-muted-foreground
                "
              >
                {executedSql}
              </pre>
            </HoverCardContent>
          </HoverCard>
        )}
        {onDownloadCsv && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Download as CSV"
                  onClick={onDownloadCsv}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <Download className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Download as CSV</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
