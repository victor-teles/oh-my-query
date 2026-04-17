import { useCallback, useEffect, useRef } from "react";

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

const READ_ONLY_LEADING =
  /^\s*(?:with\b|select\b|show\b|explain\b|describe\b|desc\b)/i;
const MUTATION_KEYWORDS =
  /\b(?:insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|replace|call|execute|vacuum|analyze|reindex|copy|lock)\b/i;

const stripStringsAndComments = (sql: string): string =>
  sql
    .replaceAll(/--[^\n]*/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/'(?:[^'\\]|\\.|'')*'/g, "")
    .replaceAll(/"(?:[^"\\]|\\.|"")*"/g, "")
    .replaceAll(/`(?:[^`\\]|\\.|``)*`/g, "");

export const isReadOnlySql = (sql: string): boolean => {
  const trimmed = sql.trim();
  if (!READ_ONLY_LEADING.test(trimmed)) {
    return false;
  }
  const scrubbed = stripStringsAndComments(trimmed);
  if (MUTATION_KEYWORDS.test(scrubbed)) {
    return false;
  }
  if (/;\s*\S/.test(scrubbed.replace(/;\s*$/, ""))) {
    return false;
  }
  return true;
};

const AUTO_RUN_CACHE_LIMIT = 200;
const autoRunSignatures = new Set<string>();

const rememberAutoRun = (signature: string) => {
  if (autoRunSignatures.size >= AUTO_RUN_CACHE_LIMIT) {
    const oldest = autoRunSignatures.values().next().value;
    if (oldest !== undefined) {
      autoRunSignatures.delete(oldest);
    }
  }
  autoRunSignatures.add(signature);
};

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
  const pendingSourceRef = useRef<"manual" | "auto">("manual");

  const runManual = useCallback(
    async (sql: string) => {
      pendingSourceRef.current = "manual";
      await run(sql);
    },
    [run]
  );

  useEffect(() => {
    if (!messageResult) {
      return;
    }
    if (status === "success" && result) {
      messageResult.publish(result, pendingSourceRef.current);
    } else if (status === "idle") {
      messageResult.clear();
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
    rememberAutoRun(signature);
    const execute = async () => {
      try {
        pendingSourceRef.current = "auto";
        await run(code);
      } catch {
        /* handled by useTransientQuery */
      }
    };
    execute();
  }, [autoRun, code, connectionId, run, schema, status]);

  const runningLabel =
    pendingSourceRef.current === "auto"
      ? "Auto-running read-only query…"
      : "Running…";

  return (
    <div>
      <SqlCodeBlock code={code} onRun={runManual} />
      {status === "running" ? (
        <InlineRunningIndicator label={runningLabel} />
      ) : null}
      {status === "success" && result ? (
        <InlineQueryResult result={result} />
      ) : null}
      {status === "error" && error ? <InlineRunError error={error} /> : null}
    </div>
  );
};
