import type { ViewUpdate } from "@codemirror/view";

import { useHotkey } from "@tanstack/react-hotkeys";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useQueryExecution } from "@/contexts/query-execution-context";
import { useQueryTabs } from "@/hooks/use-query-tabs";
import { useSyntaxTree } from "@/hooks/use-syntax-tree";
import { isSqlDatabase } from "@/lib/connections";
import { downloadCsv, tabularResultToCsv } from "@/lib/csv";
import { formatSql } from "@/lib/format-sql";

import { CommandEditor } from "./command-editor";
import { DocumentViewer } from "./document-viewer";
import { ExecuteButton } from "./execute-button";
import { FormatButton } from "./format-button";
import { QueryErrorDisplay } from "./query-error-display";
import { QueryStatusBar } from "./query-status-bar";
import { QueryTabBar } from "./query-tab-bar";
import { ResultsTable } from "./results-table";
import { SqlEditor } from "./sql-editor";
import { SyntaxTreePanel } from "./syntax-tree-panel";
import { SyntaxTreeToggle } from "./syntax-tree-toggle";

interface WorkspaceContentProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  schema: SchemaInfo | null;
}

export const WorkspaceContent = ({
  connection,
  isConnected: _isConnected,
  isConnecting,
  connectionError,
  schema,
}: WorkspaceContentProps) => {
  const {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    closeTab,
    setActiveTabId,
    updateTabSql,
    executeTab,
  } = useQueryTabs(connection.id);

  const { setExecutionState } = useQueryExecution();
  const { getSelectedText, registerQueryTable } = useEditorInsert();

  const [isSyntaxTreeOpen, setIsSyntaxTreeOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const { treeData, handleEditorUpdate: handleSyntaxTreeUpdate } =
    useSyntaxTree(isSyntaxTreeOpen);

  const activeStatus = activeTab?.status;
  const activeResult = activeTab?.result;
  const activeError = activeTab?.error;
  const isSql = isSqlDatabase(connection.type);

  const toggleSyntaxTree = useCallback(() => {
    setIsSyntaxTreeOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (activeStatus) {
      setExecutionState({
        error: activeError ?? null,
        result: activeResult ?? null,
        status: activeStatus,
      });
    }
  }, [activeStatus, activeResult, activeError, setExecutionState]);

  const handleQueryTable = useCallback(
    (tableName: string) => {
      addTabWithSql(`SELECT * FROM ${tableName};`);
    },
    [addTabWithSql]
  );

  useEffect(() => {
    registerQueryTable(handleQueryTable);
    return () => registerQueryTable(null);
  }, [registerQueryTable, handleQueryTable]);

  const handleExecute = useCallback(() => {
    if (activeTab) {
      const selectedText = getSelectedText();
      executeTab(activeTab.id, selectedText ?? undefined);
    }
  }, [activeTab, executeTab, getSelectedText]);

  const handleEditorUpdate = useCallback(
    (update: ViewUpdate) => {
      if (isSyntaxTreeOpen) {
        handleSyntaxTreeUpdate(update);
      }
      if (update.selectionSet) {
        const { from, to } = update.state.selection.main;
        setHasSelection(from !== to);
      }
    },
    [isSyntaxTreeOpen, handleSyntaxTreeUpdate]
  );

  const handleFormat = useCallback(() => {
    if (activeTab?.sql.trim() && isSql) {
      const formatted = formatSql(
        activeTab.sql,
        connection.type as "postgresql" | "mysql" | "sqlite"
      );
      updateTabSql(activeTab.id, formatted);
    }
  }, [activeTab, isSql, connection.type, updateTabSql]);

  const handleSqlChange = useCallback(
    (val: string) => {
      if (activeTab) {
        updateTabSql(activeTab.id, val);
      }
    },
    [activeTab, updateTabSql]
  );

  useHotkey("Mod+Shift+F", () => {
    handleFormat();
  });

  useHotkey("Mod+T", () => {
    addTab();
  });

  useHotkey("Mod+W", () => {
    if (activeTab) {
      closeTab(activeTab.id);
    }
  });

  useHotkey("Mod+1", () => {
    if (tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  });

  useHotkey("Mod+2", () => {
    if (tabs[1]) {
      setActiveTabId(tabs[1].id);
    }
  });

  useHotkey("Mod+3", () => {
    if (tabs[2]) {
      setActiveTabId(tabs[2].id);
    }
  });

  useHotkey("Mod+4", () => {
    if (tabs[3]) {
      setActiveTabId(tabs[3].id);
    }
  });

  useHotkey("Mod+5", () => {
    if (tabs[4]) {
      setActiveTabId(tabs[4].id);
    }
  });

  useHotkey("Mod+6", () => {
    if (tabs[5]) {
      setActiveTabId(tabs[5].id);
    }
  });

  useHotkey("Mod+7", () => {
    if (tabs[6]) {
      setActiveTabId(tabs[6].id);
    }
  });

  useHotkey("Mod+8", () => {
    if (tabs[7]) {
      setActiveTabId(tabs[7].id);
    }
  });

  useHotkey("Mod+9", () => {
    if (tabs[8]) {
      setActiveTabId(tabs[8].id);
    }
  });

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
            <div className="flex-1">
              {activeTab && isSql && (
                <SqlEditor
                  value={activeTab.sql}
                  onChange={handleSqlChange}
                  onExecute={handleExecute}
                  onUpdate={handleEditorUpdate}
                  onToggleSyntaxTree={toggleSyntaxTree}
                  databaseType={
                    connection.type as "postgresql" | "mysql" | "sqlite"
                  }
                  schema={schema}
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
          <div className="flex items-center justify-between border-b px-2 py-1">
            <span className="text-xs text-muted-foreground">
              {activeTab?.title}
            </span>
            <div className="flex items-center gap-1">
              {isSql && (
                <>
                  <FormatButton
                    disabled={!activeTab?.sql.trim()}
                    onClick={handleFormat}
                  />
                  <SyntaxTreeToggle
                    isOpen={isSyntaxTreeOpen}
                    onToggle={toggleSyntaxTree}
                  />
                </>
              )}
              <ExecuteButton
                isRunning={activeTab?.status === "running"}
                disabled={!activeTab?.sql.trim()}
                hasSelection={hasSelection}
                onClick={handleExecute}
              />
            </div>
          </div>
          <BottomPanel
            isSyntaxTreeOpen={isSyntaxTreeOpen}
            treeData={treeData}
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
  const handleDownloadCsv = useCallback(() => {
    if (result?.resultType === "tabular") {
      const csv = tabularResultToCsv(result);
      downloadCsv(csv, `query-results-${Date.now()}.csv`);
    }
  }, [result]);

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
        <QueryStatusBar result={result} onDownloadCsv={handleDownloadCsv} />
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

interface BottomPanelProps extends ResultsPanelProps {
  isSyntaxTreeOpen: boolean;
  treeData: ReturnType<typeof useSyntaxTree>["treeData"];
}

const BottomPanel = ({
  isSyntaxTreeOpen,
  treeData,
  ...resultsPanelProps
}: BottomPanelProps) => {
  if (!isSyntaxTreeOpen) {
    return <ResultsPanel {...resultsPanelProps} />;
  }

  return (
    <Tabs defaultValue="syntaxTree" className="flex h-full flex-col gap-0">
      <TabsList variant="segment" className="shrink-0">
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="syntaxTree">Syntax Tree</TabsTrigger>
      </TabsList>
      <TabsContent value="results" className="min-h-0 flex-1">
        <ResultsPanel {...resultsPanelProps} />
      </TabsContent>
      <TabsContent value="syntaxTree" className="min-h-0 flex-1">
        <SyntaxTreePanel treeData={treeData} />
      </TabsContent>
    </Tabs>
  );
};
