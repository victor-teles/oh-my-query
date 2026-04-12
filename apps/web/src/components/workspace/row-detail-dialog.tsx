import { Copy } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import type { TabularResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RowDetailDialogProps {
  result: TabularResult;
  rowIndex: number | null;
  onOpenChange: (open: boolean) => void;
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
};

const isNullish = (value: unknown): boolean =>
  value === null || value === undefined;

export const RowDetailDialog = ({
  result,
  rowIndex,
  onOpenChange,
}: RowDetailDialogProps) => {
  const row = rowIndex !== null ? result.rows[rowIndex] : null;

  const handleCopyRow = useCallback(() => {
    if (!row) {
      return;
    }
    const lines = result.columns.map(
      (col, idx) => `${col.name}: ${formatValue(row[idx])}`
    );
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied row to clipboard");
  }, [row, result.columns]);

  return (
    <Dialog onOpenChange={onOpenChange} open={rowIndex !== null}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>
              Row{" "}
              <span className="font-mono tabular-nums">
                {rowIndex !== null ? rowIndex + 1 : ""}
              </span>
            </DialogTitle>
            {row && (
              <Button
                aria-label="Copy row"
                className="mr-8"
                onClick={handleCopyRow}
                size="sm"
                title="Copy row as key: value"
                variant="ghost"
              >
                <Copy />
                Copy
              </Button>
            )}
          </div>
        </DialogHeader>
        {row && (
          <div className="max-h-[60vh] overflow-auto">
            <dl className="flex flex-col">
              {result.columns.map((col, idx) => {
                const value = row[idx];
                return (
                  <div
                    className="flex flex-col gap-0.5 border-border/40 border-b py-2 last:border-b-0"
                    key={col.name}
                  >
                    <dt className="flex items-baseline gap-2">
                      <span className="font-medium font-mono text-foreground text-xs">
                        {col.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                        {col.typeName}
                      </span>
                    </dt>
                    <dd className="font-mono text-xs leading-relaxed">
                      {isNullish(value) ? (
                        <span className="text-muted-foreground italic">
                          NULL
                        </span>
                      ) : (
                        <pre className="whitespace-pre-wrap break-words text-foreground">
                          {formatValue(value)}
                        </pre>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
