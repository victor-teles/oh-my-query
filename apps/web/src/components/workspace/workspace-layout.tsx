import type { PanelSize } from "react-resizable-panels";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useCallback, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionToolbar } from "@/components/titlebar/connection-toolbar";
import { DynamicIsland } from "@/components/titlebar/dynamic-island/dynamic-island";
import { Titlebar } from "@/components/titlebar/titlebar";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import type { WorkspaceMode } from "./workspace-mode-toggle";

import { WorkspaceContent } from "./workspace-content";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface WorkspaceLayoutProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  serverVersion: string | null;
}

const COLLAPSED_THRESHOLD = 1;

export const WorkspaceLayout = ({
  connection,
  isConnected,
  isConnecting,
  connectionError,
  serverVersion,
}: WorkspaceLayoutProps) => {
  const sidebarRef = usePanelRef();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidthPct, setSidebarWidthPct] = useState(25);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("sql");

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
    setSidebarWidthPct(size.asPercentage);
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <Titlebar
        leadingWidth={`${sidebarWidthPct}%`}
        leading={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="size-3.5" />
            ) : (
              <PanelLeftClose className="size-3.5" />
            )}
          </Button>
        }
        center={
          <DynamicIsland
            isConnecting={isConnecting}
            isConnected={isConnected}
            connectionError={connectionError}
            connectionName={connection.name}
            serverVersion={serverVersion}
            username={connection.username}
            database={connection.database}
          />
        }
      >
        <ConnectionToolbar
          connection={connection}
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={setWorkspaceMode}
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
          <WorkspaceSidebar connection={connection} isConnected={isConnected} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="75%" minSize="50%">
          <WorkspaceContent
            connection={connection}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            mode={workspaceMode}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
