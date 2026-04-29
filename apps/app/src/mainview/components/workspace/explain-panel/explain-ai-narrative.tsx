import type { ReactNode } from "react";

import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

import type { ExplainResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useExplainAiNarrative } from "@/hooks/use-explain-ai-narrative";
import { cn } from "@/lib/utils";

interface ExplainAiNarrativeProps {
  result: ExplainResult;
  sql: string;
}

export const ExplainAiNarrative = ({
  result,
  sql,
}: ExplainAiNarrativeProps) => {
  const { analyze, stop, reset, state } = useExplainAiNarrative();
  const { insertAtCursor } = useEditorInsert();

  useEffect(() => {
    reset();
  }, [result, reset]);

  const handleAnalyze = useCallback(() => {
    analyze(result, sql);
  }, [analyze, result, sql]);

  const handleInsert = useCallback(
    (code: string) => {
      insertAtCursor(`\n${code}\n`);
    },
    [insertAtCursor]
  );

  const isWorking = state.status === "streaming" || state.status === "loading";

  return (
    <div className="flex h-full flex-col border-t bg-muted/5">
      <NarrativeHeader
        isWorking={isWorking}
        onAnalyze={handleAnalyze}
        onRetry={handleAnalyze}
        onStop={stop}
        showAnalyze={state.status === "idle"}
        showRetry={state.status === "error" || state.status === "done"}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "idle" && (
          <p className="px-3 pb-3 text-xs text-muted-foreground/80">
            Diagnose the plan and suggest fixes.
          </p>
        )}

        {state.status === "loading" && (
          <p
            aria-live="polite"
            className="px-3 pb-3 text-xs text-muted-foreground"
            role="status"
          >
            Analyzing plan…
          </p>
        )}

        {(state.status === "streaming" || state.status === "done") &&
          state.text && (
            <div aria-live="polite" className="px-3 pb-3" role="status">
              <NarrativeContent
                isStreaming={state.status === "streaming"}
                onInsert={handleInsert}
                text={state.text}
              />
            </div>
          )}

        {state.status === "error" && state.errorMessage && (
          <div
            aria-live="assertive"
            className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5"
            role="alert"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 text-destructive"
            />
            <p className="text-xs text-destructive">{state.errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface NarrativeHeaderProps {
  isWorking: boolean;
  onAnalyze: () => void;
  onRetry: () => void;
  onStop: () => void;
  showAnalyze: boolean;
  showRetry: boolean;
}

const NarrativeHeader = ({
  isWorking,
  onAnalyze,
  onRetry,
  onStop,
  showAnalyze,
  showRetry,
}: NarrativeHeaderProps) => (
  <div className="flex items-center gap-2 px-3 py-1.5">
    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
      Analysis
    </span>

    <div className="ml-auto flex items-center gap-1">
      {isWorking && (
        <>
          <Loader2
            aria-hidden="true"
            className="size-3 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
          <Button
            aria-label="Stop analysis"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={onStop}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3" />
            Stop
          </Button>
        </>
      )}
      {showAnalyze && (
        <Button
          aria-label="Analyze query plan"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={onAnalyze}
          size="sm"
          variant="ghost"
        >
          Analyze
        </Button>
      )}
      {showRetry && (
        <Button
          aria-label="Re-analyze query plan"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={onRetry}
          size="sm"
          variant="ghost"
        >
          <RefreshCw aria-hidden="true" className="size-3" />
          Re-analyze
        </Button>
      )}
    </div>
  </div>
);

interface NarrativeContentProps {
  text: string;
  isStreaming: boolean;
  onInsert: (code: string) => void;
}

const SQL_BLOCK_RE = /```sql\n?([\s\S]*?)```/g;

const NarrativeContent = ({
  text,
  isStreaming,
  onInsert,
}: NarrativeContentProps) => {
  const parts: { type: "text" | "sql"; content: string; offset: number }[] = [];
  let lastIdx = 0;
  SQL_BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SQL_BLOCK_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push({
        content: text.slice(lastIdx, m.index),
        offset: lastIdx,
        type: "text",
      });
    }
    parts.push({ content: (m[1] ?? "").trim(), offset: m.index, type: "sql" });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ content: text.slice(lastIdx), offset: lastIdx, type: "text" });
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) =>
        part.type === "sql" ? (
          <SqlBlock
            code={part.content}
            key={`sql-${part.offset}`}
            onInsert={onInsert}
          />
        ) : (
          <FormattedText
            key={`text-${part.offset}`}
            showCaret={isStreaming && index === parts.length - 1}
            text={part.content}
          />
        )
      )}
    </div>
  );
};

const BOLD_SEGMENT_RE = /(\*\*[^*]+\*\*)/g;
const LIST_ITEM_RE = /^(\d+\.|[-*])\s+(.*)$/;

const renderBoldSegments = (line: string): ReactNode[] =>
  line.split(BOLD_SEGMENT_RE).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        // oxlint-disable-next-line react/no-array-index-key
        <strong key={`b-${index}`}>{part.slice(2, -2)}</strong>
      );
    }
    return (
      // oxlint-disable-next-line react/no-array-index-key
      <Fragment key={`t-${index}`}>{part}</Fragment>
    );
  });

interface FormattedTextProps {
  text: string;
  showCaret: boolean;
}

const FormattedText = ({ text, showCaret }: FormattedTextProps) => {
  let charOffset = 0;
  const lineEntries = text.split("\n").map((line) => {
    const offset = charOffset;
    charOffset += line.length + 1;
    return { line, offset };
  });

  return (
    <div className="flex flex-col gap-0.5">
      {lineEntries.map(({ line, offset }, index) => {
        const isLast = index === lineEntries.length - 1;
        if (!line.trim()) {
          return <div className="h-1" key={`l-${offset}`} />;
        }
        const listMatch = LIST_ITEM_RE.exec(line);
        if (listMatch) {
          return (
            <p
              className="flex gap-2 text-xs leading-relaxed text-foreground/85"
              key={`l-${offset}`}
            >
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {listMatch[1]}
              </span>
              <span className="min-w-0">
                {renderBoldSegments(listMatch[2] ?? "")}
                {showCaret && isLast && <StreamingCaret />}
              </span>
            </p>
          );
        }
        return (
          <p
            className="text-xs leading-relaxed text-foreground/85"
            key={`l-${offset}`}
          >
            {renderBoldSegments(line)}
            {showCaret && isLast && <StreamingCaret />}
          </p>
        );
      })}
    </div>
  );
};

const StreamingCaret = () => (
  <span
    aria-hidden="true"
    className="ml-0.5 inline-block h-3 w-px translate-y-0.5 animate-pulse bg-foreground/60 motion-reduce:animate-none"
  />
);

interface SqlBlockProps {
  code: string;
  onInsert: (code: string) => void;
}

const SqlBlock = ({ code, onInsert }: SqlBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const handleInsert = useCallback(() => {
    onInsert(code);
  }, [onInsert, code]);

  return (
    <div className="rounded-md border border-border/60 bg-background/60">
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">
        {code}
      </pre>
      <div
        className={cn(
          "flex items-center gap-1 border-t border-border/40 px-2 py-1",
          "bg-muted/20"
        )}
      >
        <Button
          aria-label="Insert into editor"
          className="h-5 gap-1 px-1.5 text-[10px]"
          onClick={handleInsert}
          size="sm"
          variant="default"
        >
          Insert into editor
        </Button>
        <Button
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="h-5 gap-1 px-1.5 text-[10px]"
          onClick={handleCopy}
          size="sm"
          variant="ghost"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <ClipboardCopy aria-hidden="true" className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
};
