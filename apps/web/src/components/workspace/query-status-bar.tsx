import type { QueryResult } from "@/lib/tauri";

interface QueryStatusBarProps {
  result: QueryResult;
}

export const QueryStatusBar = ({ result }: QueryStatusBarProps) => (
  <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
    <span>
      {result.rowCount} {result.rowCount === 1 ? "row" : "rows"}
    </span>
    <span>{result.executionTimeMs}ms</span>
    {result.isTruncated && (
      <span className="text-amber-500">Result truncated</span>
    )}
  </div>
);
