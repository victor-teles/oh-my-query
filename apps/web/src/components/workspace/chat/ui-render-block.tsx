import type { Spec } from "@json-render/core";

import { AlertCircle, Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { JSONUIProvider, Renderer, registry } from "@/lib/json-render";

interface UIRenderBlockProps {
  code: string;
}

const parseSpec = (
  code: string
): { spec: Spec | null; error: string | null } => {
  try {
    const parsed = JSON.parse(code) as Spec;
    if (!parsed.root || !parsed.elements) {
      return { error: "Invalid spec: missing root or elements", spec: null };
    }
    return { error: null, spec: parsed };
  } catch {
    return { error: null, spec: null };
  }
};

const UIRenderBlockError = ({ error }: { error: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
    <AlertCircle className="size-3.5 shrink-0" />
    <span>{error}</span>
  </div>
);

const UIRenderBlockSkeleton = () => (
  <div className="space-y-2 rounded-lg border bg-secondary/30 p-4">
    <div className="h-4 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
    <div className="h-4 w-1/2 animate-pulse rounded bg-muted-foreground/10" />
    <div className="h-20 w-full animate-pulse rounded bg-muted-foreground/10" />
  </div>
);

export const UIRenderBlock = ({ code }: UIRenderBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { spec, error } = useMemo(() => parseSpec(code), [code]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  if (error) {
    return <UIRenderBlockError error={error} />;
  }

  if (!spec) {
    return <UIRenderBlockSkeleton />;
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-secondary/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">UI</span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopy}
                  aria-label={copied ? "Copied" : "Copy JSON"}
                />
              }
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy JSON"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? "Expand" : "Collapse"}
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
      {!collapsed && (
        <div className="p-3">
          <JSONUIProvider registry={registry}>
            <Renderer spec={spec} registry={registry} />
          </JSONUIProvider>
        </div>
      )}
    </div>
  );
};
