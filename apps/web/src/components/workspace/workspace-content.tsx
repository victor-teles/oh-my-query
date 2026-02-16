import { Loader2, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { ExecuteResult, SchemaInfo } from "@/lib/tauri";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useQueryExecution } from "@/contexts/query-execution-context";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useQueryTabs } from "@/hooks/use-query-tabs";
import { hasAISettings } from "@/lib/ai-settings";
import { isSqlDatabase } from "@/lib/connections";

import type { WorkspaceMode } from "./workspace-mode-toggle";

import { AISettingsDialog } from "./ai-settings-dialog";
import { ChatInput } from "./chat/chat-input";
import { ChatMessageList } from "./chat/chat-message-list";
import { CommandEditor } from "./command-editor";
import { DocumentViewer } from "./document-viewer";
import { ExecuteButton } from "./execute-button";
import { QueryErrorDisplay } from "./query-error-display";
import { QueryStatusBar } from "./query-status-bar";
import { QueryTabBar } from "./query-tab-bar";
import { ResultsTable } from "./results-table";
import { SqlEditor } from "./sql-editor";

interface WorkspaceContentProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  mode: WorkspaceMode;
  schema: SchemaInfo | null;
  onModeChange: (mode: WorkspaceMode) => void;
}

export const WorkspaceContent = ({
  connection,
  isConnected,
  isConnecting,
  connectionError,
  mode,
  schema,
  onModeChange,
}: WorkspaceContentProps) => {
  if (mode === "chat") {
    return (
      <ChatContent
        connection={connection}
        schema={schema}
        onModeChange={onModeChange}
      />
    );
  }

  return (
    <EditorContent
      connection={connection}
      isConnected={isConnected}
      isConnecting={isConnecting}
      connectionError={connectionError}
    />
  );
};

interface EditorContentProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

const EditorContent = ({
  connection,
  isConnecting,
  connectionError,
}: EditorContentProps) => {
  const {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    closeTab,
    setActiveTabId,
    updateTabSql,
    executeTab,
  } = useQueryTabs(connection.id);

  const { setExecutionState } = useQueryExecution();

  const activeStatus = activeTab?.status;
  const activeResult = activeTab?.result;
  const activeError = activeTab?.error;
  const isSql = isSqlDatabase(connection.type);

  useEffect(() => {
    if (activeStatus) {
      setExecutionState({
        error: activeError ?? null,
        result: activeResult ?? null,
        status: activeStatus,
      });
    }
  }, [activeStatus, activeResult, activeError, setExecutionState]);

  const handleExecute = useCallback(() => {
    if (activeTab) {
      executeTab(activeTab.id);
    }
  }, [activeTab, executeTab]);

  const handleSqlChange = useCallback(
    (val: string) => {
      if (activeTab) {
        updateTabSql(activeTab.id, val);
      }
    },
    [activeTab, updateTabSql]
  );

  if (isConnecting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connecting to {connection.name}...
        </p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <QueryErrorDisplay error={connectionError} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <QueryTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onAddTab={addTab}
      />

      <ResizablePanelGroup className="flex-1" orientation="vertical">
        <ResizablePanel defaultSize="40%" minSize="15%">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-2 py-1">
              <span className="text-xs text-muted-foreground">
                {activeTab?.title}
              </span>
              <ExecuteButton
                isRunning={activeTab?.status === "running"}
                disabled={!activeTab?.sql.trim()}
                onClick={handleExecute}
              />
            </div>
            <div className="flex-1">
              {activeTab && isSql && (
                <SqlEditor
                  value={activeTab.sql}
                  onChange={handleSqlChange}
                  onExecute={handleExecute}
                  databaseType={
                    connection.type as "postgresql" | "mysql" | "sqlite"
                  }
                />
              )}
              {activeTab && !isSql && (
                <CommandEditor
                  value={activeTab.sql}
                  onChange={handleSqlChange}
                  onExecute={handleExecute}
                  databaseType={connection.type}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="60%" minSize="20%">
          <ResultsPanel
            status={activeTab?.status}
            result={activeTab?.result ?? null}
            error={activeTab?.error ?? null}
            isSql={isSql}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

const LOADING_SKELETON_IDS = ["s1", "s2", "s3", "s4", "s5"];

interface ResultsPanelProps {
  status: string | undefined;
  result: ExecuteResult | null;
  error: string | null;
  isSql: boolean;
}

const ResultsPanel = ({ status, result, error, isSql }: ResultsPanelProps) => {
  if (status === "running") {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        {LOADING_SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (status === "error" && error) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  if (status === "success" && result) {
    if (result.resultType === "documents") {
      return (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-auto">
            <DocumentViewer result={result} />
          </div>
          <QueryStatusBar result={result} />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto">
          <ResultsTable result={result} />
        </div>
        <QueryStatusBar result={result} />
      </div>
    );
  }

  const emptyMessage = isSql
    ? "Write SQL above and press Run or Cmd+Enter"
    : "Write a command above and press Run or Cmd+Enter";

  return (
    <div className="flex h-full items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Play />
          </EmptyMedia>
          <EmptyTitle>Run a query</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

interface ChatContentProps {
  connection: DatabaseConnection;
  schema: SchemaInfo | null;
  onModeChange: (mode: WorkspaceMode) => void;
}

const ChatContent = ({
  connection,
  schema,
  onModeChange,
}: ChatContentProps) => {
  const { messages, isStreaming, sendMessage, stopStreaming } = useAiChat({
    databaseType: connection.type,
    schema,
  });

  const { insertAtCursor } = useEditorInsert();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      const configured = await hasAISettings();
      setIsConfigured(configured);
    };
    checkSettings();
  }, [settingsOpen]);

  const handleInsertSql = useCallback(
    (sql: string) => {
      insertAtCursor(sql);
      onModeChange("sql");
    },
    [insertAtCursor, onModeChange]
  );

  const handleRunSql = useCallback(
    (sql: string) => {
      insertAtCursor(sql);
      onModeChange("sql");
    },
    [insertAtCursor, onModeChange]
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ChatMessageList
        messages={messages}
        connectionName={connection.name}
        onInsertSql={handleInsertSql}
        onRunSql={handleRunSql}
      />
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        onOpenSettings={handleOpenSettings}
        isStreaming={isStreaming}
        isConfigured={isConfigured}
      />
      <AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
