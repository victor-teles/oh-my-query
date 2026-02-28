import type { ReactNode } from "react";

import { Copy, Play, TableProperties } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TableNodeContextMenuProps {
  children: ReactNode;
  tableName: string;
  onOpenStructure: () => void;
  onQueryTable: () => void;
}

export const TableNodeContextMenu = ({
  children,
  tableName,
  onOpenStructure,
  onQueryTable,
}: TableNodeContextMenuProps) => {
  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(tableName);
    toast.success("Table name copied to clipboard");
  }, [tableName]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpenStructure}>
          <TableProperties />
          Open Structure
        </ContextMenuItem>
        <ContextMenuItem onClick={onQueryTable}>
          <Play />
          Query Table
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopyName}>
          <Copy />
          Copy Table Name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
