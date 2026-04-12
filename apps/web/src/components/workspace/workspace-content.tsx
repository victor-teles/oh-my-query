import type { ViewUpdate } from "@codemirror/view";

import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";
import type { QueryTab } from "@/lib/query-types";
import type { ExecuteResult, SchemaInfo } from "@/lib/tauri";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloseConfirmDialog } from "@/components/workspace/close-confirm-dialog";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useQueryExecution } from "@/contexts/query-execution-context";
import {
  QueryTabsProvider,
  useQueryTabsContext,
} from "@/contexts/query-tabs-context";
import { useExportSettings } from "@/hooks/use-export-settings";
import { useQueryTabs } from "@/hooks/use-query-tabs";
import { useSyntaxTree } from "@/hooks/use-syntax-tree";
import { useWorkspaceHotkeys } from "@/hooks/use-workspace-hotkeys";
import { isSqlDatabase } from "@/lib/connections";
import { downloadCsv, tabularResultToCsv } from "@/lib/csv";
import { formatDuration } from "@/lib/format-metrics";
import { formatSql } from "@/lib/format-sql";
import { isTabDirty } from "@/lib/query-tab-state";

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

type SqlDialect = "postgresql" | "mysql" | "sqlite" | "clickhouse";

const SQL_DIALECTS = new Set<string>([
  "postgresql",
  "mysql",
  "sqlite",
  "clickhouse",
]);

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
  onReconnect: () => void;
  schema: SchemaInfo | null;
  selectedDatabase: string | null;
}

export const WorkspaceContent = ({
  connection,
  isConnected: _isConnected,
  isConnecting,
  connectionError,
  onReconnect,
  schema,
  selectedDatabase,
}: WorkspaceContentProps) => {
  const queryTabs = useQueryTabs(connection.id, selectedDatabase);
  const isSql = isSqlDatabase(connection.type);

  if (!queryTabs.isRestored || isConnecting) {
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
      <div className="h-full overflow-auto bg-background">
        <QueryErrorDisplay error={connectionError} onReconnect={onReconnect} />
      </div>
    );
  }

  const dirtyCount = queryTabs.tabs.filter(isTabDirty).length;
  const handleCancelClose = queryTabs.onCancelClose;
  const handleConfirmClose = queryTabs.onConfirmClose;

  return (
    <QueryTabsProvider value={queryTabs}>
      <ConnectedWorkspace
        connection={connection}
        isSql={isSql}
        schema={schema}
      />
      <CloseConfirmDialog
        dirtyCount={dirtyCount}
        onCancel={handleCancelClose}
        onConfirm={handleConfirmClose}
        open={queryTabs.closeRequested}
      />
    </QueryTabsProvider>
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
  onToggleSyntaxTree?: () => void;
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
        databaseType={connectionType as SqlDialect}
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
  isSql: boolean;
}

const getResultsPanelProps = (
  activeTab: QueryTab | undefined,
  isSql: boolean
): ResultsPanelProps => ({
  error: activeTab?.error ?? null,
  errorCode: activeTab?.errorCode ?? null,
  executedSql: activeTab?.executedSql ?? null,
  isSql,
  result: activeTab?.result ?? null,
  runningSql: activeTab?.pendingExecution?.sql ?? null,
  status: activeTab?.status,
});

const ConnectedWorkspace = ({
  connection,
  schema,
  isSql,
}: ConnectedWorkspaceProps) => {
  const {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    addTabWithSql,
    closeTab,
    reopenTab,
    setActiveTabId,
    updateTabDialect,
    updateTabSql,
    executeTab,
  } = useQueryTabsContext();

  const { setExecutionState } = useQueryExecution();
  const { getSelectedText, registerQueryTable, registerOpenQuery } =
    useEditorInsert();

  const [isSyntaxTreeOpen, setIsSyntaxTreeOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const syntaxTreeEnabled = import.meta.env.DEV && isSyntaxTreeOpen;
  const { treeData, handleEditorUpdate: handleSyntaxTreeUpdate } =
    useSyntaxTree(syntaxTreeEnabled);

  const toggleSyntaxTree = useCallback(() => {
    setIsSyntaxTreeOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (activeTab?.status) {
      setExecutionState({
        error: activeTab.error ?? null,
        result: activeTab.result ?? null,
        status: activeTab.status,
      });
    }
  }, [
    activeTab?.status,
    activeTab?.result,
    activeTab?.error,
    setExecutionState,
  ]);

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
      if (syntaxTreeEnabled) {
        handleSyntaxTreeUpdate(update);
      }
      if (update.selectionSet) {
        const { from, to } = update.state.selection.main;
        setHasSelection(from !== to);
      }
    },
    [syntaxTreeEnabled, handleSyntaxTreeUpdate]
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
    reopenTab,
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

      <ResizablePanelGroup className="min-h-0 flex-1" orientation="vertical">
        <ResizablePanel defaultSize="40%" minSize="15%">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <EditorPanel
                activeTab={activeTab}
                isSql={isSql}
                connectionType={connection.type}
                editorDialect={editorDialect}
                schema={schema}
                onSqlChange={handleSqlChange}
                onExecute={handleExecute}
                onEditorUpdate={handleEditorUpdate}
                onToggleSyntaxTree={
                  import.meta.env.DEV ? toggleSyntaxTree : undefined
                }
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
            isSyntaxTreeOpen={syntaxTreeEnabled}
            onToggleSyntaxTree={toggleSyntaxTree}
            isRunning={activeTab?.status === "running"}
            isExecuteDisabled={!activeTab?.sql.trim()}
            hasSelection={hasSelection}
            onExecute={handleExecute}
          />
          <BottomPanel
            isSyntaxTreeOpen={syntaxTreeEnabled}
            treeData={treeData}
            {...getResultsPanelProps(activeTab, isSql)}
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
          {import.meta.env.DEV && (
            <SyntaxTreeToggle
              isOpen={isSyntaxTreeOpen}
              onToggle={onToggleSyntaxTree}
            />
          )}
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

const useElapsedMs = (isRunning: boolean): number => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(id);
  }, [isRunning]);
  return elapsed;
};

const SPRING_TRANSITION = {
  damping: 30,
  stiffness: 400,
  type: "spring",
} as const;
const REDUCED_MOTION_TRANSITION = { duration: 0 } as const;

const RunningSqlPreview = ({ sql }: { sql: string }) => (
  <pre
    aria-hidden="true"
    className="max-h-48 max-w-2xl overflow-hidden whitespace-pre-wrap wrap-break-word text-center font-mono text-muted-foreground/60 text-xs leading-relaxed"
    style={{
      WebkitMaskImage:
        "linear-gradient(to bottom, black 55%, transparent 100%)",
      maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
    }}
  >
    {sql.trim()}
  </pre>
);

interface RunningStatusBarProps {
  onCancel?: () => void;
}

const RunningStatusBar = ({ onCancel }: RunningStatusBarProps) => {
  const elapsed = useElapsedMs(true);
  return (
    <div
      aria-live="polite"
      className="relative flex items-center gap-2 overflow-hidden border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className="-translate-x-full pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-primary/20 to-transparent motion-safe:animate-[query-shimmer_1.8s_ease-in-out_infinite] motion-reduce:hidden"
      />
      <span className="relative inline-flex size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
      <span className="relative font-medium text-foreground">Running…</span>
      <span className="relative tabular-nums">{formatDuration(elapsed)}</span>
      {onCancel && (
        <button
          className="relative ml-auto rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

interface ResultsPanelProps {
  status: string | undefined;
  result: ExecuteResult | null;
  executedSql: string | null;
  runningSql: string | null;
  error: string | null;
  errorCode: string | null;
  isSql: boolean;
}

const ResultsPanel = ({
  status,
  result,
  executedSql,
  runningSql,
  error,
  errorCode,
  isSql,
}: ResultsPanelProps) => {
  const { settings: exportSettings } = useExportSettings();
  const { jumpTo } = useEditorInsert();
  const { activeTabId, cancelTab, executeTab } = useQueryTabsContext();

  const handleDownloadCsv = useCallback(() => {
    if (result?.resultType === "tabular") {
      const csv = tabularResultToCsv(result, {
        delimiter: exportSettings.csvDelimiter,
        includeBom: exportSettings.includeBom,
        includeHeaders: exportSettings.includeHeaders,
        nullDisplay: exportSettings.nullDisplay,
      });
      downloadCsv(csv, `query-results-${Date.now()}.csv`);
    }
  }, [result, exportSettings]);

  const handleRetry = useCallback(() => {
    if (executedSql) {
      executeTab(activeTabId, executedSql);
    }
  }, [activeTabId, executeTab, executedSql]);

  const handleCancel = useCallback(() => {
    cancelTab(activeTabId);
  }, [activeTabId, cancelTab]);

  const reducedMotion = useReducedMotion();
  const spring = reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_TRANSITION;

  const { stateKey, content } = renderResultsState({
    error,
    errorCode,
    executedSql,
    handleCancel,
    handleDownloadCsv,
    handleRetry,
    isSql,
    jumpTo,
    result,
    runningSql,
    status,
  });

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="h-full"
        exit={{ opacity: 0, y: -2 }}
        initial={{ opacity: 0, y: 2 }}
        key={stateKey}
        transition={spring}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};

interface RenderResultsStateArgs {
  error: string | null;
  errorCode: string | null;
  executedSql: string | null;
  handleCancel: () => void;
  handleDownloadCsv: () => void;
  handleRetry: () => void;
  isSql: boolean;
  jumpTo: ReturnType<typeof useEditorInsert>["jumpTo"];
  result: ExecuteResult | null;
  runningSql: string | null;
  status: string | undefined;
}

const renderResultsState = ({
  error,
  errorCode,
  executedSql,
  handleCancel,
  handleDownloadCsv,
  handleRetry,
  isSql,
  jumpTo,
  result,
  runningSql,
  status,
}: RenderResultsStateArgs): { stateKey: string; content: React.ReactNode } => {
  if (status === "running") {
    return {
      content: (
        <div className="flex h-full flex-col">
          <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
            {runningSql && <RunningSqlPreview sql={runningSql} />}
          </div>
          <RunningStatusBar onCancel={handleCancel} />
        </div>
      ),
      stateKey: "running",
    };
  }

  if (status === "error" && error) {
    return {
      content: (
        <div className="h-full overflow-auto">
          <QueryErrorDisplay
            error={error}
            errorCode={errorCode}
            onJumpToLine={jumpTo}
            onRetry={executedSql ? handleRetry : undefined}
            sql={executedSql}
          />
        </div>
      ),
      stateKey: "error",
    };
  }

  if (status === "success" && result) {
    if (result.resultType === "documents") {
      return {
        content: (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-auto">
              <DocumentViewer result={result} />
            </div>
            <QueryStatusBar executedSql={executedSql} result={result} />
          </div>
        ),
        stateKey: "success-documents",
      };
    }

    return {
      content: (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-auto">
            <ResultsTable executedSql={executedSql} result={result} />
          </div>
          <QueryStatusBar
            executedSql={executedSql}
            onDownloadCsv={handleDownloadCsv}
            result={result}
          />
        </div>
      ),
      stateKey: "success-tabular",
    };
  }

  return {
    content: (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">
            {isSql ? "Write a query above" : "Write a command above"}
          </p>
          <div className="flex items-center gap-2 text-muted-foreground/75 text-xs">
            <span>Run with</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    ),
    stateKey: "empty",
  };
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
