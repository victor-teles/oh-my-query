import { Loader2, MessageSquare, Play, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { QueryResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useQueryExecution } from "@/contexts/query-execution-context";
import { useQueryTabs } from "@/hooks/use-query-tabs";

import type { WorkspaceMode } from "./workspace-mode-toggle";

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
}

export const WorkspaceContent = ({
  connection,
  isConnected,
  isConnecting,
  connectionError,
  mode,
}: WorkspaceContentProps) => {
  if (mode === "chat") {
    return <ChatContent connection={connection} />;
  }

  return (
    <SqlEditorContent
      connection={connection}
      isConnected={isConnected}
      isConnecting={isConnecting}
      connectionError={connectionError}
    />
  );
};

interface SqlEditorContentProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

const SqlEditorContent = ({
  connection,
  isConnecting,
  connectionError,
}: SqlEditorContentProps) => {
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
              {activeTab && (
                <SqlEditor
                  value={activeTab.sql}
                  onChange={handleSqlChange}
                  onExecute={handleExecute}
                  databaseType={connection.type}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="60%" minSize="20%">
          <ResultsPanel
            status={activeTab?.status}
            result={activeTab?.result ?? null}
            error={activeTab?.error ?? null}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

const LOADING_SKELETON_IDS = ["s1", "s2", "s3", "s4", "s5"];

interface ResultsPanelProps {
  status: string | undefined;
  result: QueryResult | null;
  error: string | null;
}

const ResultsPanel = ({ status, result, error }: ResultsPanelProps) => {
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
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto">
          <ResultsTable result={result} />
        </div>
        <QueryStatusBar result={result} />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Play />
          </EmptyMedia>
          <EmptyTitle>Run a query</EmptyTitle>
          <EmptyDescription>
            Write SQL above and press Run or Cmd+Enter
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

interface ChatContentProps {
  connection: DatabaseConnection;
}

const ChatContent = ({ connection }: ChatContentProps) => {
  const [query, setQuery] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setQuery(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>Ask a question about your data</EmptyTitle>
            <EmptyDescription>
              Type a query below to get started with {connection.name}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>

      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your database..."
            className="max-h-[200px] min-h-[44px] flex-1 resize-none"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!query.trim()}
            aria-label="Send query"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};
