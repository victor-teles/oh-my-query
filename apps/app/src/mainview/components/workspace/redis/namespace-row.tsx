import { ChevronRight } from "lucide-react";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

import { NAMESPACE_SEPARATOR } from "./namespace";

interface NamespaceRowProps {
  fullName: string;
  segment: string;
  depth: number;
  keyCount: number;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: (fullName: string) => void;
}

export const NamespaceRow = ({
  fullName,
  segment,
  depth,
  keyCount,
  isExpanded,
  isActive,
  onToggle,
}: NamespaceRowProps) => {
  const handleClick = useCallback(() => {
    onToggle(fullName);
  }, [fullName, onToggle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      data-active={isActive || undefined}
      data-expanded={isExpanded || undefined}
      data-row-id={fullName}
      className={cn(`
          group relative flex h-7 w-full items-center gap-1.5 rounded-md pr-2
          text-left text-xs outline-none
        `, "hover:bg-sidebar-accent/50", "focus-visible:ring-1 focus-visible:ring-ring/60", "data-active:bg-sidebar-accent/70", `
          data-active:before:absolute data-active:before:inset-y-1
          data-active:before:left-0 data-active:before:w-[2px]
          data-active:before:rounded-full data-active:before:bg-primary/60
        `)}
      style={{ paddingLeft: `${Math.max(8, 8 + depth * 12)}px` }}
    >
      <ChevronRight className={cn(`
            size-3 shrink-0 text-muted-foreground transition-transform
            motion-reduce:transition-none
          `, isExpanded && "rotate-90")} />
      <span className="truncate font-mono text-[11px] text-foreground/75">
        {segment}
        <span className="text-muted-foreground/60">{NAMESPACE_SEPARATOR}</span>
      </span>
      <span
        className="
          ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70
          tabular-nums
        "
      >
        {keyCount}
      </span>
    </button>
  );
};
