import type { MouseEvent } from "react";

import { EllipsisIcon } from "lucide-react";

import { Pressable } from "@/components/motion/pressable";

interface CardActionsButtonProps {
  id: string;
  expanded: boolean;
  onToggle: () => void;
}

// Keeps focus inside an open menu so the press toggles it closed instead of
// blurring it shut and reopening it on click.
const keepFocus = (event: MouseEvent) => event.preventDefault();

export function CardActionsButton({
  id,
  expanded,
  onToggle,
}: CardActionsButtonProps) {
  return (
    <Pressable
      aria-expanded={expanded}
      aria-haspopup="menu"
      aria-label="Actions"
      className="grid size-6 place-items-center rounded-[6px] text-panel-muted hover:bg-row-hover hover:text-foreground aria-expanded:bg-row-active aria-expanded:text-foreground"
      id={id}
      onClick={onToggle}
      onMouseDown={keepFocus}
    >
      <EllipsisIcon aria-hidden className="size-3.5" />
    </Pressable>
  );
}
