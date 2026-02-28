import {
  ChevronRight,
  Eye,
  Link,
  ListOrdered,
  Pin,
  Play,
  Table2,
} from "lucide-react";
import { useCallback } from "react";

import type { TableItem, ViewItem } from "@/lib/tauri";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorInsert } from "@/contexts/editor-insert-context";

import { ColumnNode } from "./column-node";
import { TableContextMenu } from "./table-context-menu";

interface TableNodeProps {
  table: TableItem | ViewItem;
  isView?: boolean;
  isPinned?: boolean;
  onTogglePin?: (tableName: string) => void;
}

const isTableItem = (item: TableItem | ViewItem): item is TableItem =>
  "indexes" in item;

export const TableNode = ({
  table,
  isView = false,
  isPinned = false,
  onTogglePin,
}: TableNodeProps) => {
  const { queryTable } = useEditorInsert();
  const hasIndexes = isTableItem(table) && table.indexes.length > 0;
  const hasForeignKeys = isTableItem(table) && table.foreignKeys.length > 0;

  const handleQueryTable = useCallback(() => {
    queryTable(table.name);
  }, [queryTable, table.name]);

  const handleTogglePin = useCallback(
    (name: string) => {
      onTogglePin?.(name);
    },
    [onTogglePin]
  );

  return (
    <TableContextMenu
      table={table}
      isView={isView}
      isPinned={isPinned}
      onTogglePin={handleTogglePin}
    >
      <Collapsible className="group/table">
        <div className="flex items-center">
          <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent/50 [&[data-panel-open]>svg:first-child]:rotate-90">
            <ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform" />
            {isView ? (
              <Eye className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{table.name}</span>
            {isPinned && <Pin className="size-2.5 shrink-0 text-primary/60" />}
          </CollapsibleTrigger>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="mr-1 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground group-hover/table:opacity-100"
                  onClick={handleQueryTable}
                  aria-label={`Query ${table.name}`}
                />
              }
            >
              <Play className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Query table</TooltipContent>
          </Tooltip>
        </div>
        <CollapsibleContent>
          <div className="ml-3 border-l border-sidebar-border pl-2">
            <div className="mb-0.5 mt-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Columns ({table.columns.length})
            </div>
            {table.columns.map((col) => (
              <ColumnNode key={col.name} column={col} />
            ))}

            {hasIndexes && (
              <>
                <div className="mb-0.5 mt-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Indexes ({table.indexes.length})
                </div>
                {table.indexes.map((idx) => (
                  <div
                    key={idx.name}
                    className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                  >
                    <ListOrdered className="size-3 shrink-0" />
                    <span className="truncate">{idx.name}</span>
                    {idx.isUnique && (
                      <span className="ml-auto shrink-0 text-[10px] text-amber-500/70">
                        unique
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            {hasForeignKeys && (
              <>
                <div className="mb-0.5 mt-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Foreign Keys ({table.foreignKeys.length})
                </div>
                {table.foreignKeys.map((fk) => (
                  <div
                    key={fk.name}
                    className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                  >
                    <Link className="size-3 shrink-0" />
                    <span className="truncate">
                      {fk.columns.join(", ")} &rarr; {fk.referencedTable}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </TableContextMenu>
  );
};
