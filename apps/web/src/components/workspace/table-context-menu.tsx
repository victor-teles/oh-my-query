import type { ReactNode } from "react";

import {
  Clipboard,
  Copy,
  Pin,
  Play,
  TableProperties,
  Trash2,
} from "lucide-react";
import { useCallback } from "react";

import type { TableItem, ViewItem } from "@/lib/tauri";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import {
  generateCreateTable,
  generateDropTable,
  generateSelectTop100,
  generateTruncateTable,
} from "@/lib/sql-templates";

interface TableContextMenuProps {
  table: TableItem | ViewItem;
  isView: boolean;
  isPinned: boolean;
  onTogglePin: (tableName: string) => void;
  onOpenStructure: () => void;
  children: ReactNode;
}

export const TableContextMenu = ({
  table,
  isView,
  isPinned,
  onTogglePin,
  onOpenStructure,
  children,
}: TableContextMenuProps) => {
  const { openQuery } = useEditorInsert();

  const handleSelectTop100 = useCallback(() => {
    openQuery(generateSelectTop100(table.name));
  }, [openQuery, table.name]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(table.name);
  }, [table.name]);

  const handlePin = useCallback(() => {
    onTogglePin(table.name);
  }, [onTogglePin, table.name]);

  const handleDrop = useCallback(() => {
    openQuery(generateDropTable(table.name, isView));
  }, [openQuery, table.name, isView]);

  const handleCopyCreate = useCallback(() => {
    navigator.clipboard.writeText(generateCreateTable(table, isView));
  }, [table, isView]);

  const handleCopyDrop = useCallback(() => {
    navigator.clipboard.writeText(generateDropTable(table.name, isView));
  }, [table.name, isView]);

  const handleCopyTruncate = useCallback(() => {
    navigator.clipboard.writeText(generateTruncateTable(table.name));
  }, [table.name]);

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpenStructure}>
          <TableProperties />
          Open Structure
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSelectTop100}>
          <Play />
          Select top 100
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyName}>
          <Clipboard />
          Copy name
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePin}>
          <Pin />
          {isPinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy />
            Copy as
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleCopyCreate}>Create</ContextMenuItem>
            <ContextMenuItem onClick={handleCopyDrop}>Drop</ContextMenuItem>
            {!isView && (
              <ContextMenuItem onClick={handleCopyTruncate}>
                Truncate
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDrop} variant="destructive">
          <Trash2 />
          Drop
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
