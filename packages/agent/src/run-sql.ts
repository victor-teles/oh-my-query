import type { BindValue } from "@conch/core";
import type { AskEvent } from "@conch/rpc";

import type { AskPorts } from "./ask.ts";

import { inferCardSpec } from "./infer-card-spec.ts";
import { assertReadOnly } from "./read-only-guard.ts";
import {
  AskFailure,
  executeWithTimeout,
  lineCount,
  resultEvent,
  runToCompletion,
  throwIfAborted,
} from "./run-query.ts";

export type SqlRunPorts = Pick<
  AskPorts,
  "execute" | "dialect" | "connectionLabel"
>;

export interface SqlRunInput {
  sql: string;
  title?: string;
  params?: BindValue[];
}

const boundExecute = (
  ports: SqlRunPorts,
  params: BindValue[] | undefined
): SqlRunPorts["execute"] =>
  params ? (sql, signal) => ports.execute(sql, signal, params) : ports.execute;

async function* pipeline(
  { sql, title, params }: SqlRunInput,
  ports: SqlRunPorts,
  signal: AbortSignal
): AsyncGenerator<AskEvent> {
  throwIfAborted(signal);
  yield { dialect: ports.dialect, lines: lineCount(sql), sql, type: "sqlDone" };
  const verdict = assertReadOnly(sql, ports.dialect);
  if (!verdict.ok) {
    throw new AskFailure("NOT_READ_ONLY", verdict.reason, sql);
  }
  throwIfAborted(signal);
  yield {
    detail: `Read only on ${ports.connectionLabel}`,
    phase: "run",
    type: "phase",
  };
  const outcome = await executeWithTimeout(
    boundExecute(ports, params),
    sql,
    signal
  );
  if (!outcome.ok) {
    throw new AskFailure("QUERY_FAILED", outcome.message, sql);
  }
  yield resultEvent(outcome);
  const spec = inferCardSpec(outcome.result, {
    prompt: title ?? `Query on ${ports.connectionLabel}`,
    sql,
  });
  yield { source: "inferred", spec, type: "card" };
}

export const runSql = (
  input: SqlRunInput,
  ports: SqlRunPorts,
  signal: AbortSignal
): AsyncGenerator<AskEvent> =>
  runToCompletion(pipeline(input, ports, signal), "sql", signal);
