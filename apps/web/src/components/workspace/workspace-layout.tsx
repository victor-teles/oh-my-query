import type { PanelSize } from "react-resizable-panels";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { AIAction, AIActionType } from "@/lib/ai-actions";
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
import { composeActionMessage } from "@/lib/ai-actions";

import { ChatSidebar } from "./chat/chat-sidebar";
import { KeyboardShortcutsOverlay } from "./keyboard-shortcuts-overlay";
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
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

  useHotkey("Mod+/", () => {
    setShortcutsOpen((prev) => !prev);
  });

  const handleShowShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  const openChatPanel = useCallback(() => {
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
    }
  }, [chatPanelRef]);

  const handleAiAction = useCallback(
    (action: AIActionType, context?: { sql?: string; error?: string }) => {
      const aiAction: AIAction = {
        error: context?.error,
        sql: context?.sql,
        type: action,
      };

      const message = composeActionMessage(aiAction);
      if (message) {
        setPendingAction(aiAction);
      } else {
        setPendingAction(null);
      }
      openChatPanel();
    },
    [openChatPanel]
  );

  const handlePendingActionConsumed = useCallback(() => {
    setPendingAction(null);
  }, []);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Titlebar>
        <ConnectionToolbar
          connection={connection}
          isChatOpen={isChatOpen}
          onChatToggle={handleChatToggle}
          onShowShortcuts={handleShowShortcuts}
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
            connectionError={connectionError}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onAiAction={handleAiAction}
            onReconnect={onReconnect}
            schema={schema}
            selectedDatabase={selectedDatabase}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel
          collapsedSize="0%"
          collapsible
          defaultSize="0%"
          maxSize="50%"
          minSize="20%"
          onResize={handleChatResize}
          panelRef={chatPanelRef}
        >
          <ChatSidebar
            connection={connection}
            onClose={handleChatClose}
            pendingAction={pendingAction}
            onPendingActionConsumed={handlePendingActionConsumed}
            schema={schema}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <KeyboardShortcutsOverlay
        onOpenChange={setShortcutsOpen}
        open={shortcutsOpen}
      />
    </div>
  );
};
