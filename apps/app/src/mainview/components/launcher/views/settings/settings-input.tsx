import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function SettingsInput({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={cn(
        "h-7 w-60 rounded-[8px] border border-panel-border bg-row-hover px-2.5 font-mono text-[12px] text-foreground outline-none placeholder:font-sans placeholder:text-panel-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        className
      )}
      data-1p-ignore="true"
      spellCheck={false}
      {...props}
    />
  );
}
