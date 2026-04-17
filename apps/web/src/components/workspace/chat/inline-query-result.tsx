import { AlertCircle, Loader2 } from "lucide-react";

import type { ExecuteResult } from "@/lib/tauri";

const PREVIEW_ROW_COUNT = 10;

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatMs = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const TabularPreview = ({
  result,
}: {
  result: ExecuteResult & { resultType: "tabular" };
}) => {
  const rowsToShow = result.rows.slice(0, PREVIEW_ROW_COUNT);
  const remaining = result.rows.length - rowsToShow.length;
  const rowLabel = result.rowCount === 1 ? "row" : "rows";

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-secondary/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {result.rowCount.toLocaleString()} {rowLabel} ·{" "}
          {formatMs(result.executionTimeMs)}
        </span>
        {result.isTruncated ? (
          <span className="text-amber-600 dark:text-amber-400">Truncated</span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              {result.columns.map((col) => (
                <th
                  className="px-3 py-1.5 text-left font-medium whitespace-nowrap"
                  key={col.name}
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row, rowIdx) => (
              // eslint-disable-next-line react/no-array-index-key -- result rows have no stable id
              <tr className="border-t last:border-b-0" key={rowIdx}>
                {result.columns.map((col, cellIdx) => (
                  <td
                    className="max-w-xs truncate px-3 py-1.5 align-top whitespace-nowrap"
                    key={col.name}
                    title={formatCell(row[cellIdx])}
                  >
                    {formatCell(row[cellIdx])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {remaining > 0 ? (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            +{remaining.toLocaleString()} more{" "}
            {remaining === 1 ? "row" : "rows"}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const DocumentsPreview = ({
  result,
}: {
  result: ExecuteResult & { resultType: "documents" };
}) => {
  const docsToShow = result.documents.slice(0, PREVIEW_ROW_COUNT);
  const remaining = result.documents.length - docsToShow.length;
  const docLabel = result.count === 1 ? "document" : "documents";

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-secondary/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {result.count.toLocaleString()} {docLabel} ·{" "}
          {formatMs(result.executionTimeMs)}
        </span>
        {result.isTruncated ? (
          <span className="text-amber-600 dark:text-amber-400">Truncated</span>
        ) : null}
      </div>
      <pre className="max-h-64 overflow-auto p-3 text-xs">
        <code>{JSON.stringify(docsToShow, null, 2)}</code>
      </pre>
      {remaining > 0 ? (
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          +{remaining.toLocaleString()} more{" "}
          {remaining === 1 ? "document" : "documents"}
        </div>
      ) : null}
    </div>
  );
};

export const InlineQueryResult = ({ result }: { result: ExecuteResult }) => {
  if (result.resultType === "tabular") {
    return <TabularPreview result={result} />;
  }
  return <DocumentsPreview result={result} />;
};

export const InlineRunningIndicator = ({
  label = "Running…",
}: { label?: string } = {}) => (
  <div className="my-2 inline-flex items-center gap-2 rounded-lg border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground">
    <Loader2 className="size-3 animate-spin" />
    <span>{label}</span>
  </div>
);

export const InlineRunError = ({ error }: { error: string }) => (
  <div className="my-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
    <span className="text-xs">{error}</span>
  </div>
);
