import type { DatabaseConnection } from "@/lib/connections";

import { EMOJI_BY_TYPE } from "@/components/connection-form/constants";
import { getConnectionColorClasses } from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

interface ConnectionGlyphProps {
  connection: Pick<DatabaseConnection, "emoji" | "color" | "type">;
  className?: string;
}

export function ConnectionGlyph({
  connection,
  className,
}: ConnectionGlyphProps) {
  const colors = getConnectionColorClasses(connection.color);
  const emoji = connection.emoji?.trim();

  if (!emoji && colors) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center rounded-[7px]",
          colors.tint,
          className
        )}
      >
        <span className={cn("size-2 rounded-full", colors.dot)} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 place-items-center rounded-[7px] text-[13px] leading-none",
        colors?.tint ?? "bg-row-hover",
        className
      )}
    >
      {emoji || EMOJI_BY_TYPE[connection.type]}
    </span>
  );
}
