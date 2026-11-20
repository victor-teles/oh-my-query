import type { ReactNode } from "react";

import { ChevronLeftIcon } from "lucide-react";

import { Pressable } from "@/components/motion/pressable";

interface ViewHeaderProps {
  title: string;
  onBack: () => void;
  children?: ReactNode;
}

export function ViewHeader({ title, onBack, children }: ViewHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3">
      <Pressable
        aria-label="Back"
        autoFocus
        className="grid size-7 place-items-center rounded-[8px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        onClick={onBack}
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
      </Pressable>
      <h1 className="min-w-0 flex-1 truncate type-title text-foreground">
        {title}
      </h1>
      {children}
    </header>
  );
}
