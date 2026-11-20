import { motion } from "motion/react";
import { useLayoutEffect, useMemo, useRef } from "react";

import type { Token } from "@/lib/sql-highlight";

import { staggerDelay, useMotionPreset } from "@/lib/motion";
import { highlightLines, SQL_TOKEN_CLASSES } from "@/lib/sql-highlight";
import { cn } from "@/lib/utils";

export type SqlBlockState = "streaming" | "settled" | "stopped";

// Streaming fills a fixed box so the panel morphs once, not on every chunk.

const isMarked = (token: Token, mark: string | null): boolean =>
  mark !== null &&
  (token.kind === "keyword" || token.kind === "identifier") &&
  token.text.toLowerCase() === mark.toLowerCase();

function ChangeMark({ order }: { order: number }) {
  const { reduced, fadeIn } = useMotionPreset();
  return (
    <motion.span
      animate={{ scaleY: 1 }}
      aria-hidden
      className="absolute top-0.5 bottom-0.5 left-0.5 w-0.5 origin-top rounded-full bg-primary"
      data-testid="sql-change-mark"
      initial={{ scaleY: reduced ? 1 : 0 }}
      transition={
        reduced ? { duration: 0 } : { ...fadeIn, delay: staggerDelay(order) }
      }
    />
  );
}

interface SqlLineProps {
  number: number;
  tokens: Token[];
  mark: string | null;
  caret: boolean;
  changeOrder: number | null;
}

function SqlLine({ number, tokens, mark, caret, changeOrder }: SqlLineProps) {
  const { reduced } = useMotionPreset();
  return (
    <div className="relative flex">
      {changeOrder === null ? null : <ChangeMark order={changeOrder} />}
      <span
        aria-hidden
        className="w-9 shrink-0 pr-3 text-right text-panel-muted tabular-nums select-none"
      >
        {number}
      </span>
      <code className="min-w-0 flex-1 break-words whitespace-pre-wrap">
        {tokens.map((token, index) => (
          <span
            className={cn(
              SQL_TOKEN_CLASSES[token.kind],
              isMarked(token, mark) &&
                "underline decoration-danger-ink decoration-2 underline-offset-[3px]"
            )}
            // Tokens are positional and never reorder.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
          >
            {token.text}
          </span>
        ))}
        {caret ? (
          <span
            aria-hidden
            className={cn(
              "ml-px inline-block h-[13px] w-[6px] translate-y-[2px] rounded-[1px] bg-chart-1",
              !reduced && "ask-caret"
            )}
            data-testid="sql-caret"
          />
        ) : null}
      </code>
    </div>
  );
}

interface SqlBlockProps {
  sql: string;
  state: SqlBlockState;
  mark?: string | null;
  changed?: ReadonlySet<number>;
}

const NO_CHANGES: ReadonlySet<number> = new Set();

export function SqlBlock({
  sql,
  state,
  mark = null,
  changed = NO_CHANGES,
}: SqlBlockProps) {
  const lines = useMemo(() => highlightLines(sql), [sql]);
  const changeOrder = [...changed].toSorted((a, b) => a - b);
  const scroller = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && state === "streaming") {
      element.scrollTop = element.scrollHeight;
    }
  }, [sql, state]);

  return (
    <div
      aria-label="Generated SQL"
      className={cn(
        "max-h-[220px] overflow-y-auto px-2 py-2 font-mono text-[12px] leading-[19px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        state === "streaming" && "h-[220px]",
        state === "stopped" && "opacity-40"
      )}
      data-state={state}
      ref={scroller}
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable code must be keyboard reachable
      tabIndex={0}
    >
      {lines.map((tokens, index) => (
        <SqlLine
          caret={state === "streaming" && index === lines.length - 1}
          changeOrder={changed.has(index) ? changeOrder.indexOf(index) : null}
          // Lines only ever append while streaming.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          mark={mark}
          number={index + 1}
          tokens={tokens}
        />
      ))}
    </div>
  );
}
