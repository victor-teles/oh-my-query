import { Check, Copy, Play, SquarePen } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

interface SqlCodeBlockProps {
  code: string;
  onInsert?: (sql: string) => void;
  onRun?: (sql: string) => void;
}

export const SqlCodeBlock = ({ code, onInsert, onRun }: SqlCodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleInsert = useCallback(() => {
    onInsert?.(code);
  }, [code, onInsert]);

  const handleRun = useCallback(() => {
    onRun?.(code);
  }, [code, onRun]);

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border bg-secondary/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">SQL</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy SQL"}
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
          {onInsert && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleInsert}
              aria-label="Insert to editor"
              title="Insert to editor"
            >
              <SquarePen className="size-3" />
            </Button>
          )}
          {onRun && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleRun}
              aria-label="Run query"
              title="Run in editor"
            >
              <Play className="size-3" />
            </Button>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
};
