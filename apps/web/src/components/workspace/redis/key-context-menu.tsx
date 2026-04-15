import type { ReactNode } from "react";

import { Clipboard, Clock, Copy, Play, Trash2 } from "lucide-react";
import { useCallback } from "react";

import type { RedisKey } from "@/lib/tauri";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface KeyContextMenuProps {
  redisKey: RedisKey;
  onInspect: (key: RedisKey) => void;
  onCheckTtl: (key: RedisKey) => void;
  onCheckType: (key: RedisKey) => void;
  onCopyName: (key: RedisKey) => void;
  onRequestDelete: (key: RedisKey) => void;
  children: ReactNode;
}

export const KeyContextMenu = ({
  redisKey,
  onInspect,
  onCheckTtl,
  onCheckType,
  onCopyName,
  onRequestDelete,
  children,
}: KeyContextMenuProps) => {
  const handleInspect = useCallback(() => {
    onInspect(redisKey);
  }, [onInspect, redisKey]);
  const handleCheckTtl = useCallback(() => {
    onCheckTtl(redisKey);
  }, [onCheckTtl, redisKey]);
  const handleCheckType = useCallback(() => {
    onCheckType(redisKey);
  }, [onCheckType, redisKey]);
  const handleCopyName = useCallback(() => {
    onCopyName(redisKey);
  }, [onCopyName, redisKey]);
  const handleDelete = useCallback(() => {
    onRequestDelete(redisKey);
  }, [onRequestDelete, redisKey]);

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleInspect}>
          <Play />
          Inspect
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCheckTtl}>
          <Clock />
          Check TTL
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCheckType}>
          <Copy />
          TYPE
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyName}>
          <Clipboard />
          Copy key name
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} variant="destructive">
          <Trash2 />
          Delete key
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
