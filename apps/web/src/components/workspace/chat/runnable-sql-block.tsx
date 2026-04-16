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
        /* handled by useTransientQuery */
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
