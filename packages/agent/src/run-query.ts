import type { TabularResult } from "@conch/core";
import type { AskErrorCode, AskEvent, AskPhase } from "@conch/rpc";

import { DbError } from "@conch/core/client";

export const QUERY_TIMEOUT_MS = 30_000;

export class AskFailure extends Error {
  readonly code: AskErrorCode;
  readonly sql: string | undefined;

  constructor(code: AskErrorCode, message: string, sql?: string) {
    super(message);
    this.code = code;
    this.sql = sql;
  }
}

export const cancelled = (): AskFailure =>
  new AskFailure("CANCELLED", "The question was cancelled.");

export const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw cancelled();
  }
};

export const lineCount = (sql: string): number => sql.split("\n").length;

export type ExecuteSql = (
  sql: string,
  signal: AbortSignal
) => Promise<TabularResult>;

export type RunOutcome =
  | { ok: true; result: TabularResult; executionTimeMs: number }
  | { ok: false; message: string };

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

const settle = async <T>(work: Promise<T>): Promise<Settled<T>> => {
  try {
    return { ok: true, value: await work };
  } catch (error) {
    return { error, ok: false };
  }
};

// Drivers may ignore the signal or reject late; settle() keeps a late
// rejection from going unhandled once the abort has already won the race.
const untilAborted = (signal: AbortSignal): Promise<Settled<never>> => {
  const { promise, resolve } = Promise.withResolvers<Settled<never>>();
  const abort = () => resolve({ error: signal.reason, ok: false });
  if (signal.aborted) {
    abort();
  } else {
    signal.addEventListener("abort", abort, { once: true });
  }
  return promise;
};

export const executeWithTimeout = async (
  execute: ExecuteSql,
  sql: string,
  signal: AbortSignal
): Promise<RunOutcome> => {
  const timeout = new AbortController();
  const timer = setTimeout(
    () => timeout.abort(DbError.timeout()),
    QUERY_TIMEOUT_MS
  );
  const combined = AbortSignal.any([signal, timeout.signal]);
  const started = performance.now();
  const settled = await Promise.race([
    settle(execute(sql, combined)),
    untilAborted(combined),
  ]);
  clearTimeout(timer);

  if (settled.ok) {
    return {
      executionTimeMs: Math.round(performance.now() - started),
      ok: true,
      result: settled.value,
    };
  }
  throwIfAborted(signal);
  if (timeout.signal.aborted) {
    throw new AskFailure(
      "TIMEOUT",
      `The query took longer than ${QUERY_TIMEOUT_MS / 1000} seconds.`,
      sql
    );
  }
  return { message: DbError.fromUnknown(settled.error).message, ok: false };
};

export const resultEvent = (outcome: RunOutcome & { ok: true }): AskEvent => ({
  columns: outcome.result.columns,
  executionTimeMs: outcome.executionTimeMs,
  isTruncated: outcome.result.isTruncated,
  rowCount: outcome.result.rowCount,
  rows: outcome.result.rows,
  type: "result",
});

const toFailure = (error: unknown, signal: AbortSignal): AskFailure => {
  if (signal.aborted) {
    return cancelled();
  }
  if (error instanceof AskFailure) {
    return error;
  }
  return new AskFailure("QUERY_FAILED", DbError.fromUnknown(error).message);
};

export async function* runToCompletion(
  source: AsyncGenerator<AskEvent>,
  firstPhase: AskPhase,
  signal: AbortSignal
): AsyncGenerator<AskEvent> {
  let phase = firstPhase;
  try {
    for await (const event of source) {
      if (event.type === "phase") {
        ({ phase } = event);
      }
      yield event;
    }
  } catch (error) {
    const failure = toFailure(error, signal);
    yield {
      code: failure.code,
      message: failure.message,
      phase,
      type: "error",
      ...(failure.sql === undefined ? {} : { sql: failure.sql }),
    };
    return;
  }
  yield { type: "done" };
}
