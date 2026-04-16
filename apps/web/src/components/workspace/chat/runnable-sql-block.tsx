import { useEffect } from "react";

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

// Module-scoped so a RunnableSqlBlock that unmounts and remounts during chat
// streaming (markdown re-parses) doesn't auto-run the same statement twice.
// We key on `${connectionId}|${schema ?? ""}|${code}` and keep the entry for
// the lifetime of the session — a click-Run bypasses this dedupe entirely.
const autoRunSignatures = new Set<string>();

const buildAutoRunSignature = (
  connectionId: string,
  schema: string | undefined,
  code: string
): string => `${connectionId}|${schema ?? ""}|${code}`;

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

  // Auto-run read-only SQL once (across remounts) when the message also
  // contains a chart that binds to the result, so the user doesn't have to
  // click Run. Guarded to SELECT-shaped statements only — anything that could
  // mutate data still requires a click.
  useEffect(() => {
    if (!autoRun) {
      return;
    }
    if (!isReadOnlySql(code)) {
      return;
    }
    const signature = buildAutoRunSignature(connectionId, schema, code);
    if (autoRunSignatures.has(signature)) {
      return;
    }
    if (status !== "idle") {
      return;
    }
    autoRunSignatures.add(signature);
    const execute = async () => {
      try {
        await run(code);
      } catch {
        // errors surface through useTransientQuery's state — nothing extra to do.
      }
    };
    execute();
  }, [autoRun, code, connectionId, run, schema, status]);

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
