import { Columns3, KeyRound } from "lucide-react";
import { useCallback } from "react";

import type { ColumnDetail } from "@/lib/tauri";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorInsert } from "@/contexts/editor-insert-context";

interface ColumnNodeProps {
  column: ColumnDetail;
}

export const ColumnNode = ({ column }: ColumnNodeProps) => {
  const { insertAtCursor } = useEditorInsert();

  const handleClick = useCallback(() => {
    insertAtCursor(column.name);
  }, [insertAtCursor, column.name]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent/50"
            onClick={handleClick}
          />
        }
      >
        {column.isPrimaryKey ? (
          <KeyRound className="size-3 shrink-0 text-amber-500" />
        ) : (
          <Columns3 className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{column.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {column.dataType}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>
          {column.dataType}
          {column.isNullable ? " (nullable)" : " (not null)"}
        </p>
        {column.defaultValue && <p>Default: {column.defaultValue}</p>}
      </TooltipContent>
    </Tooltip>
  );
};
