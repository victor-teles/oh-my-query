import type { Spec, SpecIssue } from "@json-render/core";
import type { ErrorInfo, ReactNode } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  MoreHorizontal,
  Table2,
} from "lucide-react";
import { Component, useCallback, useMemo, useRef, useState } from "react";

import type { SpecParseResult } from "@/lib/json-render-validate";
import type { ExecuteResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOptionalActiveQuery } from "@/contexts/active-query-context";
import { JSONUIProvider, Renderer, registry } from "@/lib/json-render";
import {
  hasBlockingIssues,
  parseAndValidateSpec,
} from "@/lib/json-render-validate";
import { cn } from "@/lib/utils";

import { InlineQueryResult } from "./inline-query-result";
import { useOptionalMessageResult } from "./message-result-context";

interface UIRenderBlockProps {
  code: string;
}

const INLINE_ROOT_TYPES = new Set(["Badge", "Text", "Alert", "Heading"]);
const CHART_ROOT_TYPES = new Set([
  "ChartBar",
  "ChartLine",
  "ChartPie",
  "ChartKpi",
]);
const COPY_RESET_MS = 2000;

const isChartSpec = (spec: Spec): boolean => {
  const root = spec.elements[spec.root];
  return root ? CHART_ROOT_TYPES.has(root.type) : false;
};

const issueKey = (issue: SpecIssue): string =>
  `${issue.code}-${issue.elementKey ?? "_"}-${issue.message}`;

const isInlineSpec = (spec: Spec): boolean => {
  const root = spec.elements[spec.root];
  if (!root) {
    return false;
  }
  if (!INLINE_ROOT_TYPES.has(root.type)) {
    return false;
  }
  const childCount = root.children?.length ?? 0;
  return childCount === 0;
};

interface RendererErrorBoundaryProps {
  fallback: (err: Error) => ReactNode;
  children: ReactNode;
}

interface RendererErrorBoundaryState {
  error: Error | null;
}

class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  constructor(props: RendererErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<RendererErrorBoundaryState> {
    return { error };
  }

  // eslint-disable-next-line class-methods-use-this -- React error boundary lifecycle method
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ui-render-block] render crash:", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

const Skeleton = () => (
  <div className="space-y-2 rounded-lg border bg-secondary/30 p-4">
    <div className="h-4 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
    <div className="h-4 w-1/2 animate-pulse rounded bg-muted-foreground/10" />
    <div className="h-20 w-full animate-pulse rounded bg-muted-foreground/10" />
  </div>
);

interface ErrorPanelProps {
  title: string;
  detail?: string;
  rawCode: string;
  issues?: readonly SpecIssue[];
}

const ErrorPanel = ({ title, detail, rawCode, issues }: ErrorPanelProps) => {
  const [showSpec, setShowSpec] = useState(false);
  const toggleSpec = useCallback(() => {
    setShowSpec((p) => !p);
  }, []);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/5">
      <div className="flex items-start gap-2 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-medium">{title}</p>
          {detail ? (
            <p className="text-xs text-destructive/80">{detail}</p>
          ) : null}
          {issues && issues.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive/80">
              {issues.map((issue) => (
                <li key={issueKey(issue)}>
                  {issue.elementKey ? `${issue.elementKey}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="border-t border-destructive/20">
        <button
          type="button"
          onClick={toggleSpec}
          className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-destructive/80 hover:bg-destructive/10"
        >
          <span>{showSpec ? "Hide source" : "Show source"}</span>
          {showSpec ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </button>
        {showSpec ? (
          <pre className="max-h-64 overflow-auto border-t border-destructive/20 bg-background/40 p-3 text-xs">
            <code>{rawCode}</code>
          </pre>
        ) : null}
      </div>
    </div>
  );
};

const buildResultState = (
  result: ExecuteResult
): { state: Record<string, unknown>; key: string } | null => {
  if (result.resultType !== "tabular") {
    return null;
  }
  const columnNames = result.columns.map((c) => c.name);
  const rows = result.rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columnNames.length; i += 1) {
      const key = columnNames[i];
      if (key !== undefined) {
        record[key] = row[i];
      }
    }
    return record;
  });
  const resultPayload = {
    columns: result.columns,
    rowCount: result.rowCount,
    rows,
    rowsArray: result.rows,
  };
  return {
    key: `${result.rowCount}:${result.executionTimeMs}`,
    state: {
      columns: result.columns,
      result: resultPayload,
      rowCount: result.rowCount,
      rows,
    },
  };
};

const useResultInitialState = (): {
  state: Record<string, unknown>;
  key: string;
} => {
  const messageResult = useOptionalMessageResult();
  const active = useOptionalActiveQuery();
  const meta = active?.meta;

  return useMemo(() => {
    const scoped = messageResult?.result;
    if (scoped) {
      const built = buildResultState(scoped);
      if (built) {
        return { key: `msg:${built.key}`, state: built.state };
      }
    }
    if (!active || !meta) {
      return { key: "no-context", state: {} };
    }
    const snapshot = active.getSnapshot();
    const { result } = snapshot;
    if (!result) {
      return { key: `${meta.status}:no-result`, state: {} };
    }
    const built = buildResultState(result);
    if (!built) {
      return { key: `${meta.status}:non-tabular`, state: {} };
    }
    return { key: `active:${meta.status}:${built.key}`, state: built.state };
  }, [active, meta, messageResult?.result]);
};

const RenderedSpec = ({ spec }: { spec: Spec }) => {
  const { state: initialState, key } = useResultInitialState();
  return (
    <JSONUIProvider initialState={initialState} key={key} registry={registry}>
      <Renderer registry={registry} spec={spec} />
    </JSONUIProvider>
  );
};

const renderInlineErrorFallback = (err: Error): ReactNode => (
  <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs text-destructive">
    <AlertCircle className="size-3" />
    {err.message || "Couldn't render"}
  </span>
);

const InlineSpec = ({ spec, rawCode }: { spec: Spec; rawCode: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_RESET_MS);
  }, [rawCode]);

  return (
    <span className="my-1 inline-flex items-center gap-1.5 align-middle">
      <RendererErrorBoundary fallback={renderInlineErrorFallback}>
        <RenderedSpec spec={spec} />
      </RendererErrorBoundary>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={copied ? "Copied" : "Copy"}
              onClick={handleCopy}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3 opacity-60" />
          )}
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>
    </span>
  );
};

type CardSpecView = "rendered" | "spec" | "data";

const bodyPaddingClass = (view: CardSpecView, isBare: boolean): string => {
  if (view === "spec") {
    return "p-0";
  }
  return isBare ? "pt-0" : "p-3";
};

interface CardSpecHeaderProps {
  view: CardSpecView;
  collapsed: boolean;
  copied: boolean;
  hasRepairPill: boolean;
  appliedFixes: readonly string[];
  isBare: boolean;
  hasDataToggle: boolean;
  onSetView: (next: CardSpecView) => void;
  onToggleSource: () => void;
  onToggleCollapsed: () => void;
  onCopy: () => void;
}

const ChartDataToggle = ({
  view,
  onSetView,
}: {
  view: CardSpecView;
  onSetView: (next: CardSpecView) => void;
}) => {
  const showChart = useCallback(() => onSetView("rendered"), [onSetView]);
  const showData = useCallback(() => onSetView("data"), [onSetView]);

  return (
    <ButtonGroup>
      <Button
        aria-label="Show chart"
        aria-pressed={view === "rendered"}
        onClick={showChart}
        size="xs"
        variant={view === "rendered" ? "secondary" : "ghost"}
      >
        <BarChart3 />
        Chart
      </Button>
      <Button
        aria-keyshortcuts="D"
        aria-label="Show data"
        aria-pressed={view === "data"}
        onClick={showData}
        size="xs"
        variant={view === "data" ? "secondary" : "ghost"}
      >
        <Table2 />
        Data
      </Button>
    </ButtonGroup>
  );
};

const SourceToggleButton = ({
  view,
  onToggleSource,
}: {
  view: CardSpecView;
  onToggleSource: () => void;
}) => (
  <Button
    aria-keyshortcuts="S"
    aria-label={view === "rendered" ? "Show source" : "Show preview"}
    aria-pressed={view === "spec"}
    onClick={onToggleSource}
    size="xs"
    variant={view === "spec" ? "secondary" : "ghost"}
  >
    {view === "rendered" ? <Code2 /> : <Eye />}
    {view === "rendered" ? "Source" : "Preview"}
  </Button>
);

const HeaderOverflowMenu = ({
  view,
  copied,
  collapsed,
  hasDataToggle,
  onCopy,
  onToggleSource,
  onToggleCollapsed,
}: {
  view: CardSpecView;
  copied: boolean;
  collapsed: boolean;
  hasDataToggle: boolean;
  onCopy: () => void;
  onToggleSource: () => void;
  onToggleCollapsed: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button aria-label="More actions" size="icon-xs" variant="ghost" />
      }
    >
      <MoreHorizontal className="size-3" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem aria-keyshortcuts="C" onClick={onCopy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </DropdownMenuItem>
      {hasDataToggle ? (
        <DropdownMenuItem
          aria-keyshortcuts="S"
          aria-pressed={view === "spec"}
          onClick={onToggleSource}
        >
          {view === "spec" ? <Eye /> : <Code2 />}
          {view === "spec" ? "Preview" : "Source"}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        aria-keyshortcuts={collapsed ? undefined : "Escape"}
        onClick={onToggleCollapsed}
      >
        {collapsed ? <ChevronDown /> : <ChevronUp />}
        {collapsed ? "Expand" : "Collapse"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const HeaderKbdHints = ({ hasDataToggle }: { hasDataToggle: boolean }) => (
  <span
    aria-hidden
    className="inline-flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/card:opacity-100"
  >
    <Kbd>C</Kbd>
    <span>copy</span>
    <span className="text-muted-foreground/40">·</span>
    <Kbd>S</Kbd>
    <span>source</span>
    {hasDataToggle ? (
      <>
        <span className="text-muted-foreground/40">·</span>
        <Kbd>D</Kbd>
        <span>data</span>
      </>
    ) : null}
    <span className="text-muted-foreground/40">·</span>
    <Kbd>Esc</Kbd>
    <span>collapse</span>
  </span>
);

const CardSpecHeader = ({
  view,
  collapsed,
  copied,
  hasRepairPill,
  appliedFixes,
  isBare,
  hasDataToggle,
  onSetView,
  onToggleSource,
  onToggleCollapsed,
  onCopy,
}: CardSpecHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 px-3 py-1",
      !isBare && hasRepairPill && "border-b",
      isBare &&
        "absolute right-1 top-1 z-10 rounded-md bg-background/60 px-1 py-0.5 backdrop-blur-sm transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
      isBare && (hasDataToggle ? "opacity-60" : "opacity-0")
    )}
  >
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {hasRepairPill ? (
        <span
          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
          title={appliedFixes.join("\n")}
        >
          auto-repaired
        </span>
      ) : null}
      <HeaderKbdHints hasDataToggle={hasDataToggle} />
    </div>
    <div className="flex items-center gap-1">
      {hasDataToggle ? (
        <ChartDataToggle onSetView={onSetView} view={view} />
      ) : (
        <SourceToggleButton onToggleSource={onToggleSource} view={view} />
      )}
      <HeaderOverflowMenu
        collapsed={collapsed}
        copied={copied}
        hasDataToggle={hasDataToggle}
        onCopy={onCopy}
        onToggleCollapsed={onToggleCollapsed}
        onToggleSource={onToggleSource}
        view={view}
      />
    </div>
  </div>
);

interface CardSpecProps {
  spec: Spec;
  rawCode: string;
  warnings: readonly SpecIssue[];
  appliedFixes: readonly string[];
  chrome?: "card" | "bare";
  isChart?: boolean;
}

const CardSpec = ({
  spec,
  rawCode,
  warnings,
  appliedFixes,
  chrome = "card",
  isChart = false,
}: CardSpecProps) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<CardSpecView>("rendered");
  const cardRef = useRef<HTMLDivElement>(null);
  const messageResult = useOptionalMessageResult();
  const tabularResult =
    messageResult?.record?.result.resultType === "tabular"
      ? messageResult.record.result
      : null;
  const hasDataToggle = isChart && tabularResult !== null;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_RESET_MS);
  }, [rawCode]);

  const toggleSource = useCallback(() => {
    setView((v) => (v === "spec" ? "rendered" : "spec"));
  }, []);

  const setSpecificView = useCallback((next: CardSpecView) => {
    setView(next);
  }, []);

  const toggleData = useCallback(() => {
    setView((v) => (v === "data" ? "rendered" : "data"));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((p) => !p);
  }, []);

  const collapseIfOpen = useCallback(() => {
    if (!collapsed) {
      setCollapsed(true);
    }
  }, [collapsed]);

  useHotkey("C", handleCopy, { target: cardRef });
  useHotkey("S", toggleSource, { target: cardRef });
  useHotkey("D", toggleData, {
    enabled: hasDataToggle,
    target: cardRef,
  });
  useHotkey("Escape", collapseIfOpen, {
    enabled: !collapsed,
    target: cardRef,
  });

  const renderCardErrorFallback = useCallback(
    (err: Error): ReactNode => (
      <ErrorPanel
        detail={err.message}
        rawCode={rawCode}
        title="This UI crashed while rendering."
      />
    ),
    [rawCode]
  );

  const hasRepairPill = appliedFixes.length > 0;
  const isBare = chrome === "bare";
  const trustStamp =
    isBare && messageResult?.record?.source === "auto" && tabularResult
      ? `Auto-read · ${Math.round(tabularResult.executionTimeMs)}ms`
      : null;

  return (
    <div
      className={cn(
        "group/card relative my-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        isBare
          ? "focus-visible:ring-offset-2"
          : "overflow-hidden border bg-secondary/30 focus-visible:border-ring"
      )}
      ref={cardRef}
      tabIndex={0}
    >
      <CardSpecHeader
        appliedFixes={appliedFixes}
        collapsed={collapsed}
        copied={copied}
        hasDataToggle={hasDataToggle}
        hasRepairPill={hasRepairPill}
        isBare={isBare}
        onCopy={handleCopy}
        onSetView={setSpecificView}
        onToggleCollapsed={toggleCollapsed}
        onToggleSource={toggleSource}
        view={view}
      />
      {collapsed ? null : (
        <div className={cn(bodyPaddingClass(view, isBare))}>
          {view === "rendered" ? (
            <RendererErrorBoundary fallback={renderCardErrorFallback}>
              <RenderedSpec spec={spec} />
              {trustStamp ? (
                <p className="mt-1 text-[10px] tracking-wide text-muted-foreground">
                  {trustStamp}
                </p>
              ) : null}
              {warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  {warnings.map((w) => (
                    <li className="flex items-start gap-1.5" key={issueKey(w)}>
                      <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                      <span>
                        {w.elementKey ? `${w.elementKey}: ` : ""}
                        {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </RendererErrorBoundary>
          ) : null}
          {view === "data" && tabularResult ? (
            <InlineQueryResult result={tabularResult} />
          ) : null}
          {view === "spec" ? (
            <pre className="max-h-96 overflow-auto bg-background/40 p-3 text-xs">
              <code>{rawCode}</code>
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const UIRenderBlock = ({ code }: UIRenderBlockProps) => {
  const result: SpecParseResult = useMemo(
    () => parseAndValidateSpec(code),
    [code]
  );

  if (result.status === "empty" || result.status === "invalid-json") {
    return <Skeleton />;
  }

  if (result.status === "invalid-shape") {
    return (
      <ErrorPanel
        detail={result.message}
        rawCode={code}
        title="Couldn't read this UI"
      />
    );
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  if (hasBlockingIssues(result.issues)) {
    return (
      <ErrorPanel
        detail="The assistant generated something we don't know how to draw."
        issues={errors}
        rawCode={code}
        title="Couldn't render this UI"
      />
    );
  }

  if (isInlineSpec(result.spec)) {
    return <InlineSpec rawCode={code} spec={result.spec} />;
  }

  const chart = isChartSpec(result.spec);

  return (
    <CardSpec
      appliedFixes={result.appliedFixes}
      chrome={chart ? "bare" : "card"}
      isChart={chart}
      rawCode={code}
      spec={result.spec}
      warnings={warnings}
    />
  );
};
