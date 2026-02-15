import type { ExecuteResult } from "@/lib/tauri";

interface QueryStatusBarProps {
  result: ExecuteResult;
}

const getLabel = (resultType: string, count: number): string => {
  if (resultType === "documents") {
    return count === 1 ? "document" : "documents";
  }
  return count === 1 ? "row" : "rows";
};

export const QueryStatusBar = ({ result }: QueryStatusBarProps) => {
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
    </div>
  );
};
