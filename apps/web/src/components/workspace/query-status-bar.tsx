import { Download } from "lucide-react";

import type { ExecuteResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryStatusBarProps {
  result: ExecuteResult;
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
  onDownloadCsv,
}: QueryStatusBarProps) => {
  const count =
    result.resultType === "tabular" ? result.rowCount : result.count;
  const label = getLabel(result.resultType, count);

  return (
    <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
      <span>
        {count} {label}
      </span>
      <span>{result.executionTimeMs}ms</span>
      {result.isTruncated && (
        <span className="text-amber-500">Result truncated</span>
      )}
      {onDownloadCsv && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                onClick={onDownloadCsv}
                aria-label="Download as CSV"
              />
            }
          >
            <Download className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Download as CSV</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
