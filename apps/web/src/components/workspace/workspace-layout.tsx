import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useState } from "react";
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
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useWorkspaceModeHotkeys } from "@/hooks/use-workspace-mode-hotkeys";
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const { mode, setMode } = useWorkspaceMode(connection.id);

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

  useWorkspaceModeHotkeys({ setMode });

  useHotkey("Mod+B", () => {
    handleSidebarToggle();
  });

  useHotkey("Mod+Shift+C", () => {
    setMode(mode === "chat" ? "split" : "chat");
  });

  useHotkey("Mod+/", () => {
    setShortcutsOpen((prev) => !prev);
  });

  const handleShowShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  const handleAiAction = useCallback(
    (
      action: AIActionType,
      context?: {
        sql?: string;
        error?: string;
        errorCode?: string | null;
        isSelection?: boolean;
      }
    ) => {
      const aiAction: AIAction = {
        error: context?.error,
        errorCode: context?.errorCode ?? null,
        isSelection: context?.isSelection,
        sql: context?.sql,
        type: action,
      };

      const message = composeActionMessage(aiAction);
      if (message) {
        setPendingAction(aiAction);
      } else {
        setPendingAction(null);
      }
      if (mode === "editor") {
        setMode("split");
      }
    },
    [mode, setMode]
  );

  const handlePendingActionConsumed = useCallback(() => {
    setPendingAction(null);
  }, []);

  const handleChatClose = useCallback(() => {
    setMode("editor");
  }, [setMode]);

  const showEditor = mode !== "chat";
  const showChat = mode !== "editor";

  return (
    <div className="flex h-svh flex-col bg-background">
      <Titlebar>
        <ConnectionToolbar
          connection={connection}
          onShowShortcuts={handleShowShortcuts}
          onWorkspaceModeChange={setMode}
          workspaceMode={mode}
        />
      </Titlebar>
      <ResizablePanelGroup
        className="flex-1"
        key={mode}
        orientation="horizontal"
      >
        <ResizablePanel
          collapsedSize="0%"
          collapsible
          defaultSize={mode === "chat" ? "20%" : "25%"}
          maxSize="40%"
          minSize="15%"
          panelRef={sidebarRef}
        >
          <WorkspaceSidebar
            connection={connection}
            databases={databases}
            error={schemaError}
            isLoading={schemaLoading}
            refresh={refreshSchema}
            schema={schema}
            selectedDatabase={selectedDatabase}
            setSelectedDatabase={setSelectedDatabase}
          />
        </ResizablePanel>
        <ResizableHandle />

        {showEditor ? (
          <ResizablePanel
            defaultSize={mode === "split" ? "50%" : "75%"}
            minSize="30%"
          >
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
        ) : null}

        {showEditor && showChat ? <ResizableHandle /> : null}

        {showChat ? (
          <ResizablePanel
            defaultSize={mode === "chat" ? "80%" : "25%"}
            minSize="20%"
          >
            <ChatSidebar
              connection={connection}
              mode={mode}
              onClose={handleChatClose}
              onPendingActionConsumed={handlePendingActionConsumed}
              pendingAction={pendingAction}
              schema={schema}
            />
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>

      <KeyboardShortcutsOverlay
        onOpenChange={setShortcutsOpen}
        open={shortcutsOpen}
      />
    </div>
  );
};
