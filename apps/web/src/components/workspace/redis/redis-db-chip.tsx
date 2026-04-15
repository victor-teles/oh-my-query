import { Database } from "lucide-react";
import { useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RedisDbChipProps {
  dbIndex: number;
  totalKeys: number | null;
  onSelect: (dbIndex: number) => void;
  className?: string;
}

const DB_OPTIONS = Array.from({ length: 16 }, (_, i) => `db${i}`);

export const RedisDbChip = ({
  dbIndex,
  totalKeys,
  onSelect,
  className,
}: RedisDbChipProps) => {
  const handleChange = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      const parsed = Number.parseInt(value.replace(/^db/, ""), 10);
      if (Number.isFinite(parsed)) {
        onSelect(parsed);
      }
    },
    [onSelect]
  );

  const keysLabel =
    totalKeys === null
      ? "…"
      : `${totalKeys.toLocaleString()} key${totalKeys === 1 ? "" : "s"}`;

  return (
    <Select value={`db${dbIndex}`} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 gap-1.5 rounded-full border-sidebar-border bg-sidebar-accent/30 px-2.5 font-mono text-[11px] tabular-nums",
          className
        )}
      >
        <Database className="size-3 text-muted-foreground" />
        <SelectValue />
        <span className="ml-1 text-muted-foreground/70">· {keysLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {DB_OPTIONS.map((label) => (
          <SelectItem key={label} value={label}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
