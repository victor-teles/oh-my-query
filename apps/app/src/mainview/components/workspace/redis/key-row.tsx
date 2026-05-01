import { useCallback } from "react";

import type { RedisKey } from "@/lib/tauri";

import { cn } from "@/lib/utils";

import { SizeChip } from "./size-chip";
import { TtlChip } from "./ttl-chip";
import { TypeBadge } from "./type-badge";

interface KeyRowProps {
  redisKey: RedisKey;
  displayName: string;
  depth: number;
  isActive: boolean;
  onActivate: (name: string) => void;
}

export const KeyRow = ({
  redisKey,
  displayName,
  depth,
  isActive,
  onActivate,
}: KeyRowProps) => {
  const handleClick = useCallback(() => {
    onActivate(redisKey.name);
  }, [onActivate, redisKey.name]);

  return (
    <button
      type="button"
      onClick={handleClick}
      data-active={isActive || undefined}
      data-row-id={redisKey.name}
      className={cn(`
          group relative grid h-7 w-full
          grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5
          rounded-md px-2 text-left text-xs outline-none
        `, "hover:bg-sidebar-accent/50", "focus-visible:ring-1 focus-visible:ring-ring/60", "data-active:bg-sidebar-accent/70", `
          data-active:before:absolute data-active:before:inset-y-1
          data-active:before:left-0 data-active:before:w-[2px]
          data-active:before:rounded-full data-active:before:bg-primary/60
        `)}
      style={{ paddingLeft: `${Math.max(8, 8 + depth * 12)}px` }}
      title={redisKey.name}
    >
      <TypeBadge kind={redisKey.kind} />
      <span
        className={cn(
          "truncate font-medium tracking-tight",
          isActive ? "text-foreground" : "text-foreground/90"
        )}
      >
        {displayName}
      </span>
      <TtlChip ttlSecs={redisKey.ttlSecs} />
      <SizeChip size={redisKey.size} unit={redisKey.sizeUnit} />
    </button>
  );
};
