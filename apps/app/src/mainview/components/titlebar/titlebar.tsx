import type { ReactNode } from "react";

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

// Electrobun marks draggable window regions via two well-known class names
// rather than the inline `-webkit-app-region` style — see
// node_modules/electrobun/.../api/bun/preload/dragRegions.ts. Class selectors
// are unambiguous, unlike `[style*="drag"]` which would also match `no-drag`.
const DRAG = "electrobun-webkit-app-region-drag";
const NO_DRAG = "electrobun-webkit-app-region-no-drag";

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
        DRAG,
        className
      )}
    >
      {hasSidebar ? (
        <>
          <div
            className={cn(
              "flex h-full shrink-0 items-center border-r border-sidebar-border",
              DRAG
            )}
            style={leadingWidth ? { width: leadingWidth } : undefined}
          >
            <div style={{ width: TRAFFIC_LIGHT_INSET }} />
            <div className={cn("ml-auto flex items-center", NO_DRAG)}>
              {leading}
            </div>
          </div>
          <div
            className={cn(
              "relative flex h-full flex-1 items-center border-b bg-background",
              DRAG
            )}
          >
            <div className={NO_DRAG}>{center}</div>
            {children && (
              <div
                className={cn(
                  "ml-auto flex shrink-0 items-center gap-1 px-2",
                  NO_DRAG
                )}
              >
                {children}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ width: TRAFFIC_LIGHT_INSET }} />
          <div className={cn("relative flex-1", DRAG)}>
            <div className={NO_DRAG}>{center}</div>
          </div>
          {children && (
            <div
              className={cn("flex shrink-0 items-center gap-1 px-2", NO_DRAG)}
            >
              {children}
            </div>
          )}
        </>
      )}
    </header>
  );
};
