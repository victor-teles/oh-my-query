import type { ReactNode } from "react";

import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { WindowControls } from "./window-controls";

interface TitlebarProps {
  children?: ReactNode;
  leading?: ReactNode;
  leadingWidth?: string;
  className?: string;
}

export const Titlebar = ({
  children,
  leading,
  leadingWidth,
  className,
}: TitlebarProps) => (
  <header
    className={cn(
      "flex h-[38px] shrink-0 select-none items-center border-b bg-background",
      className
    )}
    data-tauri-drag-region=""
  >
    {leading ? (
      <div
        className="flex shrink-0 items-center pr-2"
        style={leadingWidth ? { width: leadingWidth } : undefined}
        data-tauri-drag-region=""
      >
        {isTauri() && <WindowControls />}
        <div className="ml-auto flex items-center">{leading}</div>
      </div>
    ) : (
      isTauri() && <WindowControls />
    )}

    <div className="flex-1" data-tauri-drag-region="" />

    {children && (
      <div className="flex shrink-0 items-center gap-1 px-2">{children}</div>
    )}
  </header>
);
