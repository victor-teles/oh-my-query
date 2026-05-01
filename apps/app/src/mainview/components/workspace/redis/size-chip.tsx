import type { RedisSizeUnit } from "@/lib/tauri";

import { cn } from "@/lib/utils";

interface SizeChipProps {
  size: number | null;
  unit: RedisSizeUnit;
  className?: string;
}

const formatSize = (size: number, unit: RedisSizeUnit): string => {
  if (unit === "bytes") {
    if (size < 1024) {
      return `${size}`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(size < 10_240 ? 1 : 0)}k`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)}M`;
  }
  return size.toLocaleString();
};

const unitSuffix = (size: number, unit: RedisSizeUnit): string => {
  switch (unit) {
    case "bytes": {
      if (size < 1024) {
        return "B";
      }
      return "";
    }
    case "fields":
    case "members":
    case "items":
    case "entries": {
      return "";
    }
    default: {
      return "";
    }
  }
};

export const SizeChip = ({ size, unit, className }: SizeChipProps) => {
  if (size === null) {
    return (
      <span aria-hidden="true" className={cn(`
            inline-flex min-w-[34px] justify-end font-mono text-[10px]
            text-muted-foreground/35 tabular-nums
          `, className)}>
        —
      </span>
    );
  }

  const value = formatSize(size, unit);
  const suffix = unitSuffix(size, unit);

  return (
    <span className={cn(`
          inline-flex min-w-[34px] justify-end font-mono text-[10px]
          text-muted-foreground/70 tabular-nums
        `, className)} title={`${size.toLocaleString()} ${unit}`}>
      {value}
      {suffix && <span className="text-muted-foreground/40">{suffix}</span>}
    </span>
  );
};
