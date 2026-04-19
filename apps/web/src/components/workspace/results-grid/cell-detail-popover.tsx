import { Copy, Expand } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { formatCell, isNull } from "@/lib/format-cell";

interface CellDetailPopoverProps {
  columnName: string;
  columnType: string;
  value: unknown;
  onOpenFullDetail: () => void;
}

const prettyFormat = (value: unknown): string => {
  if (isNull(value)) {
    return "NULL";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return formatCell(value);
};

export const CellDetailPopover = ({
  columnName,
  columnType,
  value,
  onOpenFullDetail,
}: CellDetailPopoverProps) => {
  const formatted = prettyFormat(value);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatted);
    toast.success("Copied value");
  }, [formatted]);

  return (
    <PopoverContent align="start" className="w-96" side="bottom">
      <div className="flex items-baseline justify-between gap-2 border-border/40 border-b pb-2">
        <span className="truncate font-medium font-mono text-xs text-foreground">
          {columnName}
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {columnType}
        </span>
      </div>
      <pre className="mt-2 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
        {isNull(value) ? (
          <span className="italic text-muted-foreground">NULL</span>
        ) : (
          formatted
        )}
      </pre>
      <div className="mt-2 flex items-center justify-end gap-1">
        <Button
          aria-label="Open full detail"
          onClick={onOpenFullDetail}
          size="sm"
          variant="ghost"
        >
          <Expand />
          Expand
        </Button>
        <Button
          aria-label="Copy value"
          disabled={isNull(value)}
          onClick={handleCopy}
          size="sm"
          variant="ghost"
        >
          <Copy />
          Copy
        </Button>
      </div>
    </PopoverContent>
  );
};
