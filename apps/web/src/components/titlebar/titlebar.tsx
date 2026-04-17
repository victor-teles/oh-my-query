import type { ReactNode } from "react";

import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface TitlebarProps {
  children?: ReactNode;
  center?: ReactNode;
  leading?: ReactNode;
  leadingWidth?: string;
  className?: string;
}

export const TRAFFIC_LIGHT_INSET = "78px";
export const TITLEBAR_CONTROL_HEIGHT = "h-6";

export const Titlebar = ({
  children,
  center,
  leading,
  leadingWidth,
  className,
}: TitlebarProps) => {
  const hasSidebar = !!leading;

  return (
    <header
      className={cn(
        "flex h-9.5 shrink-0 select-none items-center",
        !hasSidebar && "border-b border-sidebar-border bg-sidebar/80",
        className
      )}
      data-tauri-drag-region=""
    >
      {hasSidebar ? (
        <>
          <div
            className="flex h-full shrink-0 items-center border-r border-sidebar-border"
            style={leadingWidth ? { width: leadingWidth } : undefined}
            data-tauri-drag-region=""
          >
            {isTauri() && <div style={{ width: TRAFFIC_LIGHT_INSET }} />}
            <div className="ml-auto flex items-center">{leading}</div>
          </div>
          <div
            className="relative flex h-full flex-1 items-center border-b bg-background"
            data-tauri-drag-region=""
          >
            {center}
            {children && (
              <div className="ml-auto flex shrink-0 items-center gap-1 px-2">
                {children}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {isTauri() && <div style={{ width: TRAFFIC_LIGHT_INSET }} />}
          <div className="relative flex-1" data-tauri-drag-region="">
            {center}
          </div>
          {children && (
            <div className="flex shrink-0 items-center gap-1 px-2">
              {children}
            </div>
          )}
        </>
      )}
    </header>
  );
};
