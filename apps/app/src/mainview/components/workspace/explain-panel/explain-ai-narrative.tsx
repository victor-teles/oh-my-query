import { Check, ClipboardCopy, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

  return (
    <div className="flex shrink-0 flex-col border-t bg-muted/5">
      <NarrativeHeader
        isStreaming={state.status === "streaming" || state.status === "loading"}
        onAnalyze={handleAnalyze}
        onStop={stop}
        showAnalyze={state.status === "idle"}
        showRetry={state.status === "error" || state.status === "done"}
        onRetry={handleAnalyze}
      />

      {(state.status === "loading" ||
        state.status === "streaming" ||
        state.status === "done") && (
        <NarrativeBody
          isDone={state.status === "done"}
          isLoading={state.status === "loading"}
          onInsert={handleInsert}
          text={state.text}
        />
      )}

      {state.status === "error" && state.errorMessage && (
        <p className="px-3 pb-3 text-[11px] text-destructive">
          {state.errorMessage}
        </p>
      )}
    </div>
  );
};

interface NarrativeHeaderProps {
  isStreaming: boolean;
  onAnalyze: () => void;
  onRetry: () => void;
  onStop: () => void;
  showAnalyze: boolean;
  showRetry: boolean;
}

const NarrativeHeader = ({
  isStreaming,
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
      {isStreaming && (
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

interface NarrativeBodyProps {
  text: string;
  isDone: boolean;
  isLoading: boolean;
  onInsert: (code: string) => void;
}

const NarrativeBody = ({
  text,
  isDone,
  isLoading,
  onInsert,
}: NarrativeBodyProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 pb-3">
        <Loader2
          aria-hidden="true"
          className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <span className="text-[11px] text-muted-foreground">
          Analyzing plan…
        </span>
      </div>
    );
  }

  if (!text) {
    return null;
  }

  return (
    <div className="max-h-52 overflow-y-auto px-3 pb-3">
      <NarrativeContent isDone={isDone} onInsert={onInsert} text={text} />
    </div>
  );
};

interface NarrativeContentProps {
  text: string;
  isDone: boolean;
  onInsert: (code: string) => void;
}

const SQL_BLOCK_RE = /```sql\n?([\s\S]*?)```/g;

const NarrativeContent = ({
  text,
  isDone,
  onInsert,
}: NarrativeContentProps) => {
  if (!isDone) {
    return (
      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground/90">
        {text}
      </pre>
    );
  }

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
      {parts.map((part) =>
        part.type === "sql" ? (
          <SqlBlock
            code={part.content}
            key={`sql-${part.offset}`}
            onInsert={onInsert}
          />
        ) : (
          <FormattedText key={`text-${part.offset}`} text={part.content} />
        )
      )}
    </div>
  );
};

const FormattedText = ({ text }: { text: string }) => {
  let charOffset = 0;
  const lineEntries = text.split("\n").map((line) => {
    const offset = charOffset;
    charOffset += line.length + 1;
    return { line, offset };
  });

  return (
    <div className="flex flex-col gap-0.5">
      {lineEntries.map(({ line, offset }) => {
        if (!line.trim()) {
          return <div key={`l-${offset}`} className="h-1" />;
        }
        const boldLine = line.replaceAll(
          /\*\*(.+?)\*\*/g,
          "<strong>$1</strong>"
        );
        return (
          <p
            key={`l-${offset}`}
            className="text-[11px] leading-relaxed text-foreground/85"
            dangerouslySetInnerHTML={{ __html: boldLine }}
          />
        );
      })}
    </div>
  );
};

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
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground">
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
