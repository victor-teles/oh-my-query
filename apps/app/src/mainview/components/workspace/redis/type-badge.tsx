import type { RedisKeyKind } from "@/lib/tauri";

import { cn } from "@/lib/utils";

interface KindConfig {
  label: string;
  title: string;
  hue: number;
  chroma: number;
}

const KIND_CONFIG: Record<RedisKeyKind, KindConfig> = {
  HASH: { chroma: 0.08, hue: 135, label: "HASH", title: "Hash" },
  LIST: { chroma: 0.09, hue: 45, label: "LIST", title: "List" },
  SET: { chroma: 0.07, hue: 220, label: "SET", title: "Set" },
  STREAM: { chroma: 0.08, hue: 195, label: "STRM", title: "Stream" },
  STRING: { chroma: 0.09, hue: 75, label: "STR", title: "String" },
  UNKNOWN: { chroma: 0, hue: 0, label: "???", title: "Unknown type" },
  ZSET: { chroma: 0.08, hue: 20, label: "ZSET", title: "Sorted set" },
};

interface TypeBadgeProps {
  kind: RedisKeyKind;
  className?: string;
}

export const TypeBadge = ({ kind, className }: TypeBadgeProps) => {
  const { hue, chroma, label, title } = KIND_CONFIG[kind];
  const bg = `oklch(0.72 ${chroma} ${hue} / 0.14)`;
  const fg = `oklch(0.80 ${chroma * 1.2} ${hue})`;

  return (
    <span
      className={cn(`
          inline-flex h-[18px] min-w-[44px] items-center justify-center
          rounded-[3px] px-1.5 font-mono text-[9.5px] font-semibold
          tracking-[0.08em] tabular-nums
        `, className)}
      style={{
        backgroundColor: bg,
        color: fg,
      }}
      title={title}
    >
      {label}
    </span>
  );
};
