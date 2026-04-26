import type { CSSProperties, ReactNode } from "react";

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

// Electrobun reads CSS `-webkit-app-region: drag` (matching the WebKit
// convention) to mark draggable window regions.
const dragStyle = {
  WebkitAppRegion: "drag",
  appRegion: "drag",
} as unknown as CSSProperties;

const noDragStyle = {
  WebkitAppRegion: "no-drag",
  appRegion: "no-drag",
} as unknown as CSSProperties;

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
      style={dragStyle}
    >
      {hasSidebar ? (
        <>
          <div
            className="flex h-full shrink-0 items-center border-r border-sidebar-border"
            style={{
              ...dragStyle,
              ...(leadingWidth ? { width: leadingWidth } : {}),
            }}
          >
            <div style={{ width: TRAFFIC_LIGHT_INSET }} />
            <div className="ml-auto flex items-center" style={noDragStyle}>
              {leading}
            </div>
          </div>
          <div
            className="relative flex h-full flex-1 items-center border-b bg-background"
            style={dragStyle}
          >
            <div style={noDragStyle}>{center}</div>
            {children && (
              <div
                className="ml-auto flex shrink-0 items-center gap-1 px-2"
                style={noDragStyle}
              >
                {children}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ width: TRAFFIC_LIGHT_INSET }} />
          <div className="relative flex-1" style={dragStyle}>
            <div style={noDragStyle}>{center}</div>
          </div>
          {children && (
            <div
              className="flex shrink-0 items-center gap-1 px-2"
              style={noDragStyle}
            >
              {children}
            </div>
          )}
        </>
      )}
    </header>
  );
};
