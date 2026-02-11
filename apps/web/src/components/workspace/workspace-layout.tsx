import type { PanelSize } from "react-resizable-panels";

import { PanelLeft } from "lucide-react";
import { useCallback, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { WorkspaceContent } from "./workspace-content";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface WorkspaceLayoutProps {
  connection: DatabaseConnection;
}

const COLLAPSED_THRESHOLD = 1;

export const WorkspaceLayout = ({ connection }: WorkspaceLayoutProps) => {
  const sidebarRef = usePanelRef();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) {
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [sidebarRef]);

  const handleResize = useCallback((size: PanelSize) => {
    setSidebarCollapsed(size.asPercentage < COLLAPSED_THRESHOLD);
  }, []);

  return (
    <div className="h-svh">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          panelRef={sidebarRef}
          defaultSize={25}
          minSize={15}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onResize={handleResize}
        >
          <WorkspaceSidebar connection={connection} onToggle={toggleSidebar} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="flex h-full flex-col">
            {sidebarCollapsed && (
              <div className="flex items-center border-b px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleSidebar}
                  aria-label="Open sidebar"
                >
                  <PanelLeft className="size-4" />
                </Button>
              </div>
            )}
            <div className="flex-1">
              <WorkspaceContent connection={connection} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
