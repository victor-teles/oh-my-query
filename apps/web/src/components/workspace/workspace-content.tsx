import type { ViewUpdate } from "@codemirror/view";

import { Loader2, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";
import type { QueryTab } from "@/lib/query-types";
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
import { useWorkspaceHotkeys } from "@/hooks/use-workspace-hotkeys";
import { isSqlDatabase } from "@/lib/connections";
import { downloadCsv, tabularResultToCsv } from "@/lib/csv";
import { formatSql } from "@/lib/format-sql";

import { CommandEditor } from "./command-editor";
import { DialectSelector } from "./dialect-selector";
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

type SqlDialect = "postgresql" | "mysql" | "sqlite";

const SQL_DIALECTS = new Set<string>(["postgresql", "mysql", "sqlite"]);

const resolveEditorDialect = (
  sourceDialect: string | null,
  connectionType: string
): SqlDialect =>
  sourceDialect && SQL_DIALECTS.has(sourceDialect)
    ? (sourceDialect as SqlDialect)
    : (connectionType as SqlDialect);

interface WorkspaceContentProps {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  schema: SchemaInfo | null;
  selectedDatabase: string | null;
}

export const WorkspaceContent = ({
  connection,
  isConnected: _isConnected,
  isConnecting,
  connectionError,
  schema,
  selectedDatabase,
}: WorkspaceContentProps) => {
  const {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    closeTab,
    setActiveTabId,
    updateTabDialect,
    updateTabSql,
    executeTab,
    isRestored,
  } = useQueryTabs(connection.id, selectedDatabase);

  const isSql = isSqlDatabase(connection.type);

  if (!isRestored || isConnecting) {
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
    <ConnectedWorkspace
      connection={connection}
      schema={schema}
      selectedDatabase={selectedDatabase}
      tabs={tabs}
      activeTab={activeTab}
      activeTabId={activeTabId}
      isSql={isSql}
      addTab={addTab}
      addTabWithSql={addTabWithSql}
      closeTab={closeTab}
      setActiveTabId={setActiveTabId}
      updateTabDialect={updateTabDialect}
      updateTabSql={updateTabSql}
      executeTab={executeTab}
    />
  );
};

interface EditorPanelProps {
  activeTab: QueryTab | undefined;
  isSql: boolean;
  connectionType: DatabaseType;
  editorDialect: SqlDialect;
  schema: SchemaInfo | null;
  onSqlChange: (val: string) => void;
  onExecute: () => void;
  onEditorUpdate: (update: ViewUpdate) => void;
  onToggleSyntaxTree: () => void;
}

const EditorPanel = ({
  activeTab,
  isSql,
  connectionType,
  editorDialect,
  schema,
  onSqlChange,
  onExecute,
  onEditorUpdate,
  onToggleSyntaxTree,
}: EditorPanelProps) => {
  if (!activeTab) {
    return null;
  }

  if (isSql) {
    return (
      <SqlEditor
        value={activeTab.sql}
        onChange={onSqlChange}
        onExecute={onExecute}
        onUpdate={onEditorUpdate}
        onToggleSyntaxTree={onToggleSyntaxTree}
        databaseType={connectionType as "postgresql" | "mysql" | "sqlite"}
        writingDialect={editorDialect}
        schema={schema}
      />
    );
  }

  return (
    <CommandEditor
      value={activeTab.sql}
      onChange={onSqlChange}
      onExecute={onExecute}
      databaseType={connectionType}
    />
  );
};

interface ConnectedWorkspaceProps {
  connection: DatabaseConnection;
  schema: SchemaInfo | null;
  selectedDatabase: string | null;
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  activeTabId: string;
  isSql: boolean;
  addTab: () => void;
  addTabWithSql: (sql: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (id: string) => void;
  updateTabDialect: (tabId: string, dialect: string | null) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  executeTab: (tabId: string, sqlOverride?: string) => void;
}

const ConnectedWorkspace = ({
  connection,
  schema,
  selectedDatabase: _selectedDatabase,
  tabs,
  activeTab,
  activeTabId,
  isSql,
  addTab,
  addTabWithSql,
  closeTab,
  setActiveTabId,
  updateTabDialect,
  updateTabSql,
  executeTab,
}: ConnectedWorkspaceProps) => {
  const { setExecutionState } = useQueryExecution();
  const { getSelectedText, registerQueryTable, registerOpenQuery } =
    useEditorInsert();

  const [isSyntaxTreeOpen, setIsSyntaxTreeOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const { treeData, handleEditorUpdate: handleSyntaxTreeUpdate } =
    useSyntaxTree(isSyntaxTreeOpen);

  const activeStatus = activeTab?.status;
  const activeResult = activeTab?.result;
  const activeError = activeTab?.error;

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

  useEffect(() => {
    registerOpenQuery(addTabWithSql);
    return () => registerOpenQuery(null);
  }, [registerOpenQuery, addTabWithSql]);

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

  const editorDialect = resolveEditorDialect(
    activeTab?.sourceDialect ?? null,
    connection.type
  );

  const handleFormat = useCallback(async () => {
    if (!activeTab?.sql.trim() || !isSql) {
      return;
    }

    try {
      const formatted = await formatSql(activeTab.sql, editorDialect);
      updateTabSql(activeTab.id, formatted);
    } catch {
      // Leave SQL unchanged on format error
    }
  }, [activeTab, isSql, editorDialect, updateTabSql]);

  const handleSqlChange = useCallback(
    (val: string) => {
      if (activeTab) {
        updateTabSql(activeTab.id, val);
      }
    },
    [activeTab, updateTabSql]
  );

  const handleDialectChange = useCallback(
    (dialect: string) => {
      if (activeTab) {
        const newDialect = dialect === connection.type ? null : dialect;
        updateTabDialect(activeTab.id, newDialect);
      }
    },
    [activeTab, connection.type, updateTabDialect]
  );

  useWorkspaceHotkeys({
    activeTab,
    addTab,
    closeTab,
    handleFormat,
    setActiveTabId,
    tabs,
  });

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
              <EditorPanel
                activeTab={activeTab}
                isSql={isSql}
                connectionType={connection.type}
                editorDialect={editorDialect}
                schema={schema}
                onSqlChange={handleSqlChange}
                onExecute={handleExecute}
                onEditorUpdate={handleEditorUpdate}
                onToggleSyntaxTree={toggleSyntaxTree}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="60%" minSize="20%">
          <EditorToolbar
            title={activeTab?.title}
            isSql={isSql}
            sourceDialect={activeTab?.sourceDialect ?? null}
            connectionType={connection.type}
            onDialectChange={handleDialectChange}
            isFormatDisabled={!activeTab?.sql.trim()}
            onFormat={handleFormat}
            isSyntaxTreeOpen={isSyntaxTreeOpen}
            onToggleSyntaxTree={toggleSyntaxTree}
            isRunning={activeTab?.status === "running"}
            isExecuteDisabled={!activeTab?.sql.trim()}
            hasSelection={hasSelection}
            onExecute={handleExecute}
          />
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

interface EditorToolbarProps {
  title: string | undefined;
  isSql: boolean;
  sourceDialect: string | null;
  connectionType: string;
  onDialectChange: (dialect: string) => void;
  isFormatDisabled: boolean;
  onFormat: () => void;
  isSyntaxTreeOpen: boolean;
  onToggleSyntaxTree: () => void;
  isRunning: boolean;
  isExecuteDisabled: boolean;
  hasSelection: boolean;
  onExecute: () => void;
}

const EditorToolbar = ({
  title,
  isSql,
  sourceDialect,
  connectionType,
  onDialectChange,
  isFormatDisabled,
  onFormat,
  isSyntaxTreeOpen,
  onToggleSyntaxTree,
  isRunning,
  isExecuteDisabled,
  hasSelection,
  onExecute,
}: EditorToolbarProps) => (
  <div className="flex items-center justify-between border-b px-2 py-1">
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{title}</span>
      {isSql && (
        <DialectSelector
          value={sourceDialect ?? connectionType}
          connectionDialect={connectionType}
          onChange={onDialectChange}
        />
      )}
    </div>
    <div className="flex items-center gap-1">
      {isSql && (
        <>
          <FormatButton disabled={isFormatDisabled} onClick={onFormat} />
          <SyntaxTreeToggle
            isOpen={isSyntaxTreeOpen}
            onToggle={onToggleSyntaxTree}
          />
        </>
      )}
      <ExecuteButton
        isRunning={isRunning}
        disabled={isExecuteDisabled}
        hasSelection={hasSelection}
        onClick={onExecute}
      />
    </div>
  </div>
);

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
