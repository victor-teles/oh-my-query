import type { ReactNode } from "react";

import { Clipboard, Clock, Copy, Pin, Play, Trash2 } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseType } from "@/lib/connections";
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
  redisDeleteCommand,
  redisInspectCommand,
  redisTtlCommand,
  redisTypeCommand,
} from "@/lib/sql-templates";

interface TableContextMenuProps {
  table: TableItem | ViewItem;
  isView: boolean;
  isPinned: boolean;
  onTogglePin: (tableName: string) => void;
  children: ReactNode;
  databaseType?: DatabaseType;
}

export const TableContextMenu = ({
  table,
  isView,
  isPinned,
  onTogglePin,
  children,
  databaseType,
}: TableContextMenuProps) => {
  const { openQuery } = useEditorInsert();
  const isRedis = databaseType === "redis";
  const redisKind = table.columns[0]?.dataType ?? "STRING";

  const handleInspect = useCallback(() => {
    if (isRedis) {
      openQuery(redisInspectCommand(table.name, redisKind));
    } else {
      openQuery(generateSelectTop100(table.name));
    }
  }, [isRedis, openQuery, redisKind, table.name]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(table.name);
  }, [table.name]);

  const handlePin = useCallback(() => {
    onTogglePin(table.name);
  }, [onTogglePin, table.name]);

  const handleDrop = useCallback(() => {
    if (isRedis) {
      openQuery(redisDeleteCommand(table.name));
    } else {
      openQuery(generateDropTable(table.name, isView));
    }
  }, [isRedis, isView, openQuery, table.name]);

  const handleCopyCreate = useCallback(() => {
    navigator.clipboard.writeText(generateCreateTable(table, isView));
  }, [table, isView]);

  const handleCopyDrop = useCallback(() => {
    navigator.clipboard.writeText(
      isRedis
        ? redisDeleteCommand(table.name)
        : generateDropTable(table.name, isView)
    );
  }, [isRedis, table.name, isView]);

  const handleCopyTruncate = useCallback(() => {
    navigator.clipboard.writeText(generateTruncateTable(table.name));
  }, [table.name]);

  const handleRedisCheckTtl = useCallback(() => {
    openQuery(redisTtlCommand(table.name));
  }, [openQuery, table.name]);

  const handleRedisCheckType = useCallback(() => {
    openQuery(redisTypeCommand(table.name));
  }, [openQuery, table.name]);

  const inspectLabel = isRedis ? `Inspect (${redisKind})` : "Select top 100";
  const dropLabel = isRedis ? "Delete key (DEL)" : "Drop";

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleInspect}>
          <Play />
          {inspectLabel}
        </ContextMenuItem>
        {isRedis && (
          <>
            <ContextMenuItem onClick={handleRedisCheckTtl}>
              <Clock />
              Check TTL
            </ContextMenuItem>
            <ContextMenuItem onClick={handleRedisCheckType}>
              <Copy />
              TYPE
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem onClick={handleCopyName}>
          <Clipboard />
          {isRedis ? "Copy key" : "Copy name"}
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePin}>
          <Pin />
          {isPinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        {!isRedis && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Copy />
                Copy as
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleCopyCreate}>
                  Create
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopyDrop}>Drop</ContextMenuItem>
                {!isView && (
                  <ContextMenuItem onClick={handleCopyTruncate}>
                    Truncate
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDrop} variant="destructive">
          <Trash2 />
          {dropLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
