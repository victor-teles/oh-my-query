import type { Spec, SpecIssue } from "@json-render/core";
import type { ErrorInfo, ReactNode } from "react";

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
} from "lucide-react";
import { Component, useCallback, useMemo, useState } from "react";

import type { SpecParseResult } from "@/lib/json-render-validate";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { JSONUIProvider, Renderer, registry } from "@/lib/json-render";
import {
  hasBlockingIssues,
  parseAndValidateSpec,
} from "@/lib/json-render-validate";
import { cn } from "@/lib/utils";

interface UIRenderBlockProps {
  code: string;
}

const INLINE_ROOT_TYPES = new Set(["Badge", "Text", "Alert", "Heading"]);
const COPY_RESET_MS = 2000;

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

const formatRootLabel = (spec: Spec): string => {
  const root = spec.elements[spec.root];
  return root ? `UI · ${root.type}` : "UI";
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
          <span>{showSpec ? "Hide spec" : "View raw spec"}</span>
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

const RenderedSpec = ({ spec }: { spec: Spec }) => (
  <JSONUIProvider registry={registry}>
    <Renderer registry={registry} spec={spec} />
  </JSONUIProvider>
);

const renderInlineErrorFallback = (err: Error): ReactNode => (
  <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs text-destructive">
    <AlertCircle className="size-3" />
    {err.message || "Render error"}
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
              aria-label={copied ? "Copied" : "Copy JSON"}
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
        <TooltipContent>{copied ? "Copied!" : "Copy spec"}</TooltipContent>
      </Tooltip>
    </span>
  );
};

interface CardSpecProps {
  spec: Spec;
  rawCode: string;
  warnings: readonly SpecIssue[];
  appliedFixes: readonly string[];
}

const CardSpec = ({ spec, rawCode, warnings, appliedFixes }: CardSpecProps) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<"rendered" | "spec">("rendered");

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_RESET_MS);
  }, [rawCode]);

  const toggleView = useCallback(() => {
    setView((v) => (v === "rendered" ? "spec" : "rendered"));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((p) => !p);
  }, []);

  const renderCardErrorFallback = useCallback(
    (err: Error): ReactNode => (
      <ErrorPanel
        detail={err.message}
        rawCode={rawCode}
        title="The component crashed while rendering."
      />
    ),
    [rawCode]
  );

  const label = formatRootLabel(spec);

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-secondary/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{label}</span>
          {appliedFixes.length > 0 ? (
            <span
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              title={appliedFixes.join("\n")}
            >
              auto-repaired
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={
                    view === "rendered" ? "View raw spec" : "View rendered UI"
                  }
                  aria-pressed={view === "spec"}
                  onClick={toggleView}
                  size="icon-xs"
                  variant={view === "spec" ? "secondary" : "ghost"}
                />
              }
            >
              {view === "rendered" ? (
                <Code2 className="size-3" />
              ) : (
                <Eye className="size-3" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {view === "rendered" ? "View spec" : "View rendered"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={copied ? "Copied" : "Copy JSON"}
                  onClick={handleCopy}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy spec"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={collapsed ? "Expand" : "Collapse"}
                  onClick={toggleCollapsed}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              {collapsed ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronUp className="size-3" />
              )}
            </TooltipTrigger>
            <TooltipContent>{collapsed ? "Expand" : "Collapse"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {collapsed ? null : (
        <div className={cn(view === "spec" ? "p-0" : "p-3")}>
          {view === "rendered" ? (
            <RendererErrorBoundary fallback={renderCardErrorFallback}>
              <RenderedSpec spec={spec} />
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
          ) : (
            <pre className="max-h-96 overflow-auto bg-background/40 p-3 text-xs">
              <code>{rawCode}</code>
            </pre>
          )}
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
        title="Invalid UI spec"
      />
    );
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  if (hasBlockingIssues(result.issues)) {
    return (
      <ErrorPanel
        detail="The model produced a spec that can't render safely."
        issues={errors}
        rawCode={code}
        title="UI spec has structural errors"
      />
    );
  }

  if (isInlineSpec(result.spec)) {
    return <InlineSpec rawCode={code} spec={result.spec} />;
  }

  return (
    <CardSpec
      appliedFixes={result.appliedFixes}
      rawCode={code}
      spec={result.spec}
      warnings={warnings}
    />
  );
};
