import { AlertTriangle, Flame, Loader2, Play, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { QueryTab } from "@/lib/query-types";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useConnection } from "@/contexts/connection-context";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useQueryTabsContext } from "@/contexts/query-tabs-context";
import { ENGINE_SUPPORTS_ANALYZE, ENGINE_SUPPORTS_EXPLAIN } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { ExplainAiNarrative } from "./explain-ai-narrative";
import {
  ExplainErrorState,
  ExplainIdleState,
  ExplainUnsupportedState,
} from "./explain-empty-states";
import { PlanNodeDetails } from "./plan-node-details";
import { PlanRawView } from "./plan-raw-view";
import { PlanTree } from "./plan-tree";
import {
  computePlanAnalysis,
  defaultExpandedNodes,
  findNodeById,
  flattenVisibleNodes,
  usePlanAnalysis,
} from "./use-plan-analysis";

type ViewMode = "tree" | "raw";

const SPRING_TRANSITION = {
  damping: 30,
  stiffness: 400,
  type: "spring",
} as const;
const REDUCED_MOTION_TRANSITION = { duration: 0 } as const;

const formatDurationMs = (ms: number): string => {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

interface ExplainPanelProps {
  tab: QueryTab | undefined;
  hasSelection: boolean;
}

export const ExplainPanel = ({ tab, hasSelection }: ExplainPanelProps) => {
  const { connection } = useConnection();
  const { cancelExplain, explainTab, setExplainAnalyze } =
    useQueryTabsContext();
  const { getSelectedText } = useEditorInsert();
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const reducedMotion = useReducedMotion();
  const spring = reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_TRANSITION;

  const engine = connection.type;
  const isEngineSupported = ENGINE_SUPPORTS_EXPLAIN[engine] ?? false;
  const supportsAnalyze = ENGINE_SUPPORTS_ANALYZE[engine] ?? false;

  const handleRun = useCallback(() => {
    if (tab) {
      const selectedText = getSelectedText();
      explainTab(tab.id, selectedText ?? undefined);
    }
  }, [tab, explainTab, getSelectedText]);

  const handleCancel = useCallback(() => {
    if (tab) {
      cancelExplain(tab.id);
    }
  }, [tab, cancelExplain]);

  const handleToggleAnalyze = useCallback(() => {
    if (tab) {
      setExplainAnalyze(tab.id, !tab.explainAnalyze);
    }
  }, [tab, setExplainAnalyze]);

  if (!tab) {
    return null;
  }

  if (!isEngineSupported) {
    return (
      <div className="flex h-full flex-col">
        <ExplainHeader
          analyze={tab.explainAnalyze}
          analyzeSupported={supportsAnalyze}
          canRun={false}
          engine={engine}
          hasSelection={hasSelection}
          isRunning={false}
          onCancel={handleCancel}
          onRun={handleRun}
          onToggleAnalyze={handleToggleAnalyze}
          onViewChange={setViewMode}
          showViewToggle={false}
          viewMode={viewMode}
        />
        <div className="min-h-0 flex-1">
          <ExplainUnsupportedState engine={engine} />
        </div>
      </div>
    );
  }

  const canRun = tab.sql.trim().length > 0 && tab.explainStatus !== "running";
  const { explainError: error, explainResult: result } = tab;

  return (
    <div className="flex h-full flex-col">
      <ExplainHeader
        analyze={tab.explainAnalyze}
        analyzeSupported={supportsAnalyze}
        canRun={canRun}
        engine={engine}
        hasSelection={hasSelection}
        isRunning={tab.explainStatus === "running"}
        onCancel={handleCancel}
        onRun={handleRun}
        onToggleAnalyze={handleToggleAnalyze}
        onViewChange={setViewMode}
        showViewToggle={Boolean(result)}
        viewMode={viewMode}
      />

      {result && <ExplainSummaryStrip result={result} />}

      <div className="min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
            exit={{ opacity: 0, y: -2 }}
            initial={{ opacity: 0, y: 2 }}
            key={computeStateKey(tab.explainStatus, result, viewMode)}
            transition={spring}
          >
            <ExplainBody
              error={error}
              result={result}
              sql={tab.sql}
              status={tab.explainStatus}
              viewMode={viewMode}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const computeStateKey = (
  status: QueryTab["explainStatus"],
  result: QueryTab["explainResult"],
  viewMode: ViewMode
): string => {
  if (status === "running") {
    return "explain-running";
  }
  if (status === "error") {
    return "explain-error";
  }
  if (status === "success" && result) {
    return viewMode === "raw" ? "explain-raw" : "explain-tree";
  }
  return "explain-idle";
};

interface ExplainBodyProps {
  result: QueryTab["explainResult"];
  status: QueryTab["explainStatus"];
  error: string | null;
  sql: string;
  viewMode: ViewMode;
}

const ExplainBody = ({
  result,
  status,
  error,
  sql,
  viewMode,
}: ExplainBodyProps) => {
  if (status === "running") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Loader2
          aria-hidden="true"
          className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <p className="text-muted-foreground text-xs">Fetching plan…</p>
      </div>
    );
  }
  if (status === "error" && error) {
    return <ExplainErrorState message={error} />;
  }
  if (status === "success" && result) {
    if (viewMode === "raw") {
      return <PlanRawView raw={result.raw} />;
    }
    return <PlanInspector result={result} sql={sql} />;
  }
  return <ExplainIdleState />;
};

interface PlanInspectorProps {
  result: NonNullable<QueryTab["explainResult"]>;
  sql: string;
}

const PlanInspector = ({ result, sql }: PlanInspectorProps) => {
  const analysis = useMemo(
    () => computePlanAnalysis(result.root),
    [result.root]
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(result.root.id);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpandedNodes(result.root, analysis.hotPath)
  );

  useEffect(() => {
    setSelectedNodeId(result.root.id);
    setExpanded(defaultExpandedNodes(result.root, analysis.hotPath));
  }, [result.root, analysis.hotPath]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const visibleNodes = useMemo(
    () => flattenVisibleNodes(result.root, expanded),
    [result.root, expanded]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIdx = visibleNodes.findIndex(
        (v) => v.node.id === selectedNodeId
      );
      if (currentIdx === -1) {
        return;
      }
      const current = visibleNodes[currentIdx];
      if (!current) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          visibleNodes[Math.min(currentIdx + 1, visibleNodes.length - 1)];
        if (next) {
          setSelectedNodeId(next.node.id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = visibleNodes[Math.max(currentIdx - 1, 0)];
        if (next) {
          setSelectedNodeId(next.node.id);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (current.hasChildren && current.isExpanded) {
          handleToggleExpand(current.node.id);
        } else if (current.parentId) {
          setSelectedNodeId(current.parentId);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (current.hasChildren && !current.isExpanded) {
          handleToggleExpand(current.node.id);
        } else if (current.hasChildren) {
          const [firstChild] = current.node.children;
          if (firstChild) {
            setSelectedNodeId(firstChild.id);
          }
        }
      } else if ((e.key === "Enter" || e.key === " ") && current.hasChildren) {
        e.preventDefault();
        handleToggleExpand(current.node.id);
      }
    },
    [visibleNodes, selectedNodeId, handleToggleExpand]
  );

  const selectedNode = findNodeById(result.root, selectedNodeId) ?? result.root;

  return (
    <ResizablePanelGroup className="h-full" orientation="vertical">
      <ResizablePanel defaultSize="70%" minSize="40%">
        <ResizablePanelGroup className="h-full" orientation="horizontal">
          <ResizablePanel defaultSize="60%" minSize="35%">
            <div
              className="h-full overflow-auto outline-none"
              onKeyDown={handleKeyDown}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: tree needs keyboard focus
              tabIndex={0}
            >
              <PlanTree
                expanded={expanded}
                hotPath={analysis.hotPath}
                maxCost={analysis.maxCost}
                onSelect={setSelectedNodeId}
                onToggleExpand={handleToggleExpand}
                root={result.root}
                selectedNodeId={selectedNodeId}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="40%" minSize="25%">
            <div className="h-full overflow-auto p-3">
              <PlanNodeDetails node={selectedNode} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="30%" minSize="15%">
        <div className="h-full overflow-auto">
          <ExplainAiNarrative result={result} sql={sql} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

interface ExplainHeaderProps {
  analyze: boolean;
  analyzeSupported: boolean;
  canRun: boolean;
  engine: string;
  hasSelection: boolean;
  isRunning: boolean;
  onCancel: () => void;
  onRun: () => void;
  onToggleAnalyze: () => void;
  onViewChange: (mode: ViewMode) => void;
  showViewToggle: boolean;
  viewMode: ViewMode;
}

const ExplainHeader = ({
  analyze,
  analyzeSupported,
  canRun,
  engine,
  hasSelection,
  isRunning,
  onCancel,
  onRun,
  onToggleAnalyze,
  onViewChange,
  showViewToggle,
  viewMode,
}: ExplainHeaderProps) => (
  <div className="flex shrink-0 items-center gap-2 border-b bg-muted/10 px-2 py-1.5">
    <span className="rounded-sm border border-border/60 bg-background/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
      {engine}
    </span>

    {isRunning ? (
      <Button
        aria-label="Cancel EXPLAIN"
        className="h-7 gap-1 px-2 text-xs"
        onClick={onCancel}
        size="sm"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-3.5" />
        Cancel
      </Button>
    ) : (
      <Button
        aria-label={hasSelection ? "Explain selected SQL" : "Run EXPLAIN"}
        className="h-7 gap-1 px-2 text-xs"
        disabled={!canRun}
        onClick={onRun}
        size="sm"
        variant="default"
      >
        <Play aria-hidden="true" className="size-3" />
        {hasSelection ? "Explain selection" : "Explain"}
      </Button>
    )}

    <label
      className={cn(
        "flex items-center gap-1.5 text-[11px] transition-opacity",
        !analyzeSupported && "opacity-40"
      )}
    >
      <input
        aria-label="Run with ANALYZE"
        checked={analyze}
        className="size-3 rounded-sm border-border accent-primary"
        disabled={!analyzeSupported || isRunning}
        onChange={onToggleAnalyze}
        type="checkbox"
      />
      <span className="text-muted-foreground">ANALYZE</span>
      {!analyzeSupported && (
        <span
          aria-label="Not supported for this engine"
          className="text-muted-foreground/60"
        >
          (n/a)
        </span>
      )}
    </label>

    {analyze && analyzeSupported && (
      <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
        will execute
      </span>
    )}

    <div className="ml-auto flex items-center gap-1">
      {showViewToggle && (
        <ViewToggle onViewChange={onViewChange} viewMode={viewMode} />
      )}
    </div>
  </div>
);

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}

const ViewToggle = ({ viewMode, onViewChange }: ViewToggleProps) => {
  const selectTree = useCallback(() => onViewChange("tree"), [onViewChange]);
  const selectRaw = useCallback(() => onViewChange("raw"), [onViewChange]);
  return (
    <div className="flex overflow-hidden rounded-sm border border-border/60">
      <button
        aria-pressed={viewMode === "tree"}
        className={cn(
          "px-2 py-0.5 text-[10px] transition-colors",
          viewMode === "tree"
            ? "bg-background text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={selectTree}
        type="button"
      >
        Tree
      </button>
      <button
        aria-pressed={viewMode === "raw"}
        className={cn(
          "px-2 py-0.5 text-[10px] transition-colors",
          viewMode === "raw"
            ? "bg-background text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={selectRaw}
        type="button"
      >
        Raw
      </button>
    </div>
  );
};

const ExplainSummaryStrip = ({
  result,
}: {
  result: NonNullable<QueryTab["explainResult"]>;
}) => {
  const { totalWarnings, hotPath } = usePlanAnalysis(result.root);
  return (
    <div className="flex shrink-0 items-center gap-4 border-b bg-muted/20 px-3 py-1.5 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">
          {result.analyzeRan ? "ANALYZE" : "plan"}
        </span>
        <span className="font-mono font-semibold text-foreground tabular-nums">
          {formatDurationMs(result.executionTimeMs)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Flame aria-hidden="true" className="size-3 text-warning" />
        <span className="text-muted-foreground">hot path</span>
        <span className="font-mono font-semibold text-foreground tabular-nums">
          {hotPath.size}
        </span>
        <span className="text-muted-foreground">
          {hotPath.size === 1 ? "node" : "nodes"}
        </span>
      </div>

      {totalWarnings > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle aria-hidden="true" className="size-3 text-warning" />
          <span className="font-semibold text-warning">{totalWarnings}</span>
          <span className="text-muted-foreground">
            {totalWarnings === 1 ? "warning" : "warnings"}
          </span>
        </div>
      )}

      <div className="ml-auto text-[10px] text-muted-foreground">
        <kbd className="rounded-sm border border-border/60 bg-background/50 px-1 py-px font-mono">
          ↑↓
        </kbd>{" "}
        navigate ·{" "}
        <kbd className="rounded-sm border border-border/60 bg-background/50 px-1 py-px font-mono">
          ←→
        </kbd>{" "}
        collapse/expand
      </div>
    </div>
  );
};
