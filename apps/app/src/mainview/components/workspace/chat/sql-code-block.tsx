import { Check, Copy, Play, Replace, SquarePen } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { HighlightedSql } from "./highlighted-sql";

interface SqlCodeBlockProps {
  code: string;
  onInsert?: (sql: string) => void;
  onReplace?: (sql: string) => void;
  onRun?: (sql: string) => void;
  hasSelection?: boolean;
}

export const SqlCodeBlock = ({
  code,
  onInsert,
  onReplace,
  onRun,
  hasSelection = false,
}: SqlCodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [insertConfirmed, setInsertConfirmed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleInsert = useCallback(() => {
    onInsert?.(code);
    setInsertConfirmed(true);
    setTimeout(() => setInsertConfirmed(false), 2000);
  }, [code, onInsert]);

  const handleReplace = useCallback(() => {
    onReplace?.(code);
    setReplaceConfirmed(true);
    setTimeout(() => setReplaceConfirmed(false), 2000);
  }, [code, onReplace]);

  const handleRun = useCallback(() => {
    onRun?.(code);
  }, [code, onRun]);

  return (
    <div
      className="
        group relative my-2 overflow-hidden rounded-lg border bg-secondary/30
      "
    >
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">SQL</span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopy}
                  aria-label={copied ? "Copied" : "Copy SQL"}
                />
              }
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
          </Tooltip>
          {hasSelection && onReplace && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleReplace}
                    aria-label={
                      replaceConfirmed ? "Replaced" : "Replace selection"
                    }
                  />
                }
              >
                {replaceConfirmed ? (
                  <Check className="size-3" />
                ) : (
                  <Replace className="size-3" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {replaceConfirmed ? "Replaced!" : "Replace selection"}
              </TooltipContent>
            </Tooltip>
          )}
          {onInsert && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleInsert}
                    aria-label={
                      insertConfirmed ? "Inserted" : "Insert to editor"
                    }
                  />
                }
              >
                {insertConfirmed ? (
                  <Check className="size-3" />
                ) : (
                  <SquarePen className="size-3" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {insertConfirmed ? "Inserted!" : "Insert to editor"}
              </TooltipContent>
            </Tooltip>
          )}
          {onRun && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRun}
                    aria-label="Run query"
                  />
                }
              >
                <Play className="size-3" />
              </TooltipTrigger>
              <TooltipContent>Run query</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <HighlightedSql code={code} />
    </div>
  );
};
