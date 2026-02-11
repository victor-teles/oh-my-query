import type { PanelSize } from "react-resizable-panels";

import { useCallback, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionToolbar } from "@/components/titlebar/connection-toolbar";
import { Titlebar } from "@/components/titlebar/titlebar";
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
    <div className="flex h-svh flex-col">
      <Titlebar>
        <ConnectionToolbar
          connection={connection}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
      </Titlebar>
      <ResizablePanelGroup className="flex-1" orientation="horizontal">
        <ResizablePanel
          panelRef={sidebarRef}
          defaultSize="25%"
          minSize="15%"
          maxSize="40%"
          collapsible
          collapsedSize="0%"
          onResize={handleResize}
        >
          <WorkspaceSidebar connection={connection} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="75%" minSize="50%">
          <WorkspaceContent connection={connection} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
