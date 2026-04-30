import { ExternalLink, RefreshCw, Settings } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { AISettingsDialog } from "@/components/workspace/ai-settings-dialog";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { cn } from "@/lib/utils";

import type { NarrativeStatus } from "./use-plan-narrative";

interface PlanNarrativePanelProps {
  status: Exclude<NarrativeStatus, "idle">;
  content: string;
  errorMessage: string | null;
  errorRetryable: boolean;
  onRetry: () => void;
  onCancel: () => void;
}

interface TextSegment {
  type: "text";
  content: string;
}

interface SqlSegment {
  type: "sql";
  code: string;
}

type ContentSegment = TextSegment | SqlSegment;

const parseContent = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  const sqlBlockRegex = /```sql\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  sqlBlockRegex.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((match = sqlBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        content: content.slice(lastIndex, match.index),
        type: "text",
      });
    }
    segments.push({ code: match[1]?.trim() ?? "", type: "sql" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ content: content.slice(lastIndex), type: "text" });
  }

  return segments;
};

const renderInlineFormatting = (text: string): React.ReactNode[] => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  const nodes: React.ReactNode[] = [];
  for (let pi = 0; pi < parts.length; pi += 1) {
    const part = parts[pi] ?? "";
    if (pi % 2 === 1) {
      nodes.push(
        <strong key={part} className="font-semibold text-foreground">
          {part}
        </strong>
      );
    } else if (part) {
      nodes.push(part);
    }
  }
  return nodes;
};

const SqlBlock = ({ code }: { code: string }) => {
  const { openQuery } = useEditorInsert();
  const handleOpen = useCallback(() => {
    openQuery(code);
  }, [code, openQuery]);

  return (
    <div className="my-2.5 overflow-hidden rounded-md border border-border/50 bg-background">
      <div className="flex items-center justify-between border-b border-border/40 px-2.5 py-1">
        <span className="font-mono text-[9px] font-medium text-muted-foreground/70 uppercase tracking-widest">
          sql
        </span>
        <Button
          className="h-5 gap-1 px-1.5 text-[10px]"
          onClick={handleOpen}
          size="sm"
          variant="ghost"
        >
          <ExternalLink aria-hidden className="size-2.5" />
          Open in editor
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const StreamingCursor = () => (
  <span
    aria-hidden
    className="inline-block h-[0.85em] w-[0.45em] translate-y-[0.05em] bg-foreground/50 motion-safe:animate-[blink_1s_step-end_infinite] motion-reduce:opacity-0"
  />
);

const NarrativeContent = ({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) => {
  const segments = parseContent(content);

  return (
    <div aria-live="polite" className="space-y-0.5" role="status">
      {segments.map((seg, segIndex) => {
        const isLast = segIndex === segments.length - 1;

        if (seg.type === "sql") {
          return <SqlBlock key={seg.code} code={seg.code} />;
        }

        const lines = seg.content.split("\n");
        const rendered: React.ReactNode[] = [];

        for (let j = 0; j < lines.length; j += 1) {
          const line = lines[j] ?? "";

          if (!line.trim()) {
            if (j > 0 && lines[j - 1]?.trim()) {
              rendered.push(<div key={`gap-${j}`} className="h-1.5" />);
            }
            continue;
          }

          const isNumbered = /^\d+\./.test(line.trim());
          const isBulleted = /^[-•*]/.test(line.trim());

          rendered.push(
            <p
              key={`line-${j}`}
              className={cn(
                "text-xs leading-relaxed text-foreground/90",
                (isNumbered || isBulleted) && "pl-4 -indent-4"
              )}
            >
              {renderInlineFormatting(line)}
            </p>
          );
        }

        return (
          <div key={seg.content.slice(0, 24)}>
            {rendered}
            {isLast && isStreaming && <StreamingCursor />}
          </div>
        );
      })}
      {segments.length === 0 && isStreaming && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <StreamingCursor />
          <span>Analyzing…</span>
        </span>
      )}
    </div>
  );
};

export const PlanNarrativePanel = ({
  status,
  content,
  errorMessage,
  errorRetryable,
  onRetry,
}: PlanNarrativePanelProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  if (status === "unconfigured") {
    return (
      <div className="flex flex-col gap-2.5 p-3">
        <p className="text-xs text-muted-foreground">
          AI analysis requires an API key.
        </p>
        <Button
          className="h-6 w-fit gap-1.5 px-2 text-[11px]"
          onClick={handleOpenSettings}
          size="sm"
          variant="outline"
        >
          <Settings aria-hidden className="size-3" />
          Set up AI
        </Button>
        <AISettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        aria-live="assertive"
        className="m-3 rounded-md border border-destructive/30 bg-destructive/10 p-3"
        role="alert"
      >
        <p className="text-xs text-destructive">
          {errorMessage ?? "Analysis failed."}
        </p>
        {errorRetryable && (
          <Button
            className="mt-2 h-6 gap-1 px-2 text-[11px]"
            onClick={onRetry}
            size="sm"
            variant="ghost"
          >
            <RefreshCw aria-hidden className="size-3" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      <NarrativeContent
        content={content}
        isStreaming={status === "streaming"}
      />
    </div>
  );
};
