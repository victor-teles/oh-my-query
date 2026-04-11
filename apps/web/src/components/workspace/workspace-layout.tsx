import type { PanelSize } from "react-resizable-panels";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionToolbar } from "@/components/titlebar/connection-toolbar";
import { Titlebar } from "@/components/titlebar/titlebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSchema } from "@/hooks/use-schema";
import { useWorkspaceIslandSync } from "@/hooks/use-workspace-island-sync";

import { ChatSidebar } from "./chat/chat-sidebar";
import { WorkspaceContent } from "./workspace-content";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface WorkspaceLayoutProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  serverVersion: string | null;
  onReconnect: () => void;
}

export const WorkspaceLayout = ({
  connection,
  isConnected,
  isConnecting,
  isReconnecting,
  connectionError,
  serverVersion,
  onReconnect,
}: WorkspaceLayoutProps) => {
  const sidebarRef = usePanelRef();
  const chatPanelRef = usePanelRef();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const hasBeenOpenedRef = useRef(false);

  useWorkspaceIslandSync({
    connection,
    connectionError,
    isConnected,
    isConnecting,
    isReconnecting,
    onReconnect,
    serverVersion,
  });

  const {
    schema,
    isLoading: schemaLoading,
    error: schemaError,
    refresh: refreshSchema,
    databases,
    selectedDatabase,
    setSelectedDatabase,
  } = useSchema(connection.id, isConnected);

  const handleChatResize = useCallback((size: PanelSize) => {
    setIsChatOpen(size.asPercentage > 0);
  }, []);

  const handleChatToggle = useCallback(() => {
    const panel = chatPanelRef.current;
    if (!panel) {
      return;
    }

    if (panel.isCollapsed()) {
      if (!hasBeenOpenedRef.current) {
        panel.resize("30%");
        hasBeenOpenedRef.current = true;
      } else {
        panel.expand();
      }
      setIsChatOpen(true);
    } else {
      panel.collapse();
      setIsChatOpen(false);
    }
  }, [chatPanelRef]);

  const handleChatClose = useCallback(() => {
    chatPanelRef.current?.collapse();
    setIsChatOpen(false);
  }, [chatPanelRef]);

  const handleSidebarToggle = useCallback(() => {
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

  useHotkey("Mod+B", () => {
    handleSidebarToggle();
  });

  useHotkey("Mod+Shift+C", () => {
    handleChatToggle();
  });

  return (
    <div className="flex h-svh flex-col bg-background">
      <Titlebar>
        <ConnectionToolbar
          connection={connection}
          isChatOpen={isChatOpen}
          onChatToggle={handleChatToggle}
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

        <ResizablePanel defaultSize="75%" minSize="30%">
          <WorkspaceContent
            connection={connection}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            schema={schema}
            selectedDatabase={selectedDatabase}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel
          panelRef={chatPanelRef}
          defaultSize="0%"
          minSize="20%"
          maxSize="50%"
          collapsible
          collapsedSize="0%"
          onResize={handleChatResize}
        >
          <ChatSidebar
            connection={connection}
            schema={schema}
            onClose={handleChatClose}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
