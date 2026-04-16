import { useEffect, useRef } from "react";

import { useTransientQuery } from "@/hooks/use-transient-query";

import {
  InlineQueryResult,
  InlineRunError,
  InlineRunningIndicator,
} from "./inline-query-result";
import { useOptionalMessageResult } from "./message-result-context";
import { SqlCodeBlock } from "./sql-code-block";

interface RunnableSqlBlockProps {
  code: string;
  connectionId: string;
  schema?: string;
  autoRun?: boolean;
}

const READ_ONLY_STATEMENT =
  /^\s*(?:with\b|select\b|show\b|explain\b|describe\b|desc\b)/i;

export const isReadOnlySql = (sql: string): boolean =>
  READ_ONLY_STATEMENT.test(sql.trim());

export const RunnableSqlBlock = ({
  code,
  connectionId,
  schema,
  autoRun = false,
}: RunnableSqlBlockProps) => {
  const { run, status, result, error } = useTransientQuery({
    connectionId,
    schema,
  });

  const messageResult = useOptionalMessageResult();

  // Publish the result to the message-scoped context so sibling chart blocks
  // in the same assistant message can bind to it via $bindState: /result/rows.
  useEffect(() => {
    if (!messageResult) {
      return;
    }
    if (status === "success" && result) {
      messageResult.setResult(result);
    } else if (status === "idle") {
      messageResult.setResult(null);
    }
  }, [messageResult, result, status]);

  // Auto-run read-only SQL once when the block mounts, so the user doesn't have
  // to click Run before a sibling chart can populate. Guarded to SELECT-shaped
  // statements only — anything that could mutate data still requires a click.
  const hasAutoRunRef = useRef(false);
  useEffect(() => {
    if (!autoRun || hasAutoRunRef.current) {
      return;
    }
    if (status !== "idle") {
      return;
    }
    if (!isReadOnlySql(code)) {
      return;
    }
    hasAutoRunRef.current = true;
    const execute = async () => {
      try {
        await run(code);
      } catch {
        // errors surface through useTransientQuery's state — nothing extra to do.
      }
    };
    execute();
  }, [autoRun, code, run, status]);

  return (
    <div>
      <SqlCodeBlock code={code} onRun={run} />
      {status === "running" ? <InlineRunningIndicator /> : null}
      {status === "success" && result ? (
        <InlineQueryResult result={result} />
      ) : null}
      {status === "error" && error ? <InlineRunError error={error} /> : null}
    </div>
  );
};
