import type { PanelSize } from "react-resizable-panels";

import { useCallback, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionToolbar } from "@/components/titlebar/connection-toolbar";
import { DynamicIsland } from "@/components/titlebar/dynamic-island/dynamic-island";
import { Titlebar } from "@/components/titlebar/titlebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSchema } from "@/hooks/use-schema";

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

export const WorkspaceLayout = ({
  connection,
  isConnected,
  isConnecting,
  connectionError,
  serverVersion,
}: WorkspaceLayoutProps) => {
  const sidebarRef = usePanelRef();
  const [sidebarWidthPct, setSidebarWidthPct] = useState(25);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("sql");

  const {
    schema,
    isLoading: schemaLoading,
    error: schemaError,
    refresh: refreshSchema,
    databases,
    selectedDatabase,
    setSelectedDatabase,
  } = useSchema(connection.id, isConnected);

  const handleResize = useCallback((size: PanelSize) => {
    setSidebarWidthPct(size.asPercentage);
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <Titlebar
        leadingWidth={`${sidebarWidthPct - 0.08}%`}
        leading={<div />}
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
          className="border-r border-sidebar-border"
        >
          <WorkspaceSidebar
            connection={connection}
            schema={schema}
            isLoading={schemaLoading}
            error={schemaError}
            refresh={refreshSchema}
            databases={databases}
            selectedDatabase={selectedDatabase}
            setSelectedDatabase={setSelectedDatabase}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="75%" minSize="50%">
          <WorkspaceContent
            connection={connection}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            mode={workspaceMode}
            schema={schema}
            onModeChange={setWorkspaceMode}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
