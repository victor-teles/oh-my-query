import type {
  DialectType,
  LookupLimits,
  LookupProbe,
  LookupValue,
  Pool,
  SchemaInfo,
} from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type {
  LookupErrorCode,
  LookupEvent,
  LookupEventMessage,
} from "@conch/rpc";

import { assertReadOnly } from "@conch/agent";
import {
  CancellationRegistry,
  compileSqlTemplate,
  DbError,
  DEFAULT_LOOKUP_LIMITS,
  lookupTemplateValue,
  planLookupProbes,
  raceWithCancel,
} from "@conch/core";
import { LookupRequest } from "@conch/rpc";

import type { SchemaCache } from "./schema-cache.ts";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
  tabular,
} from "./connection-access.ts";

export interface LookupTiming {
  concurrency: number;
  probeTimeoutMs: number;
  budgetMs: number;
}

export const LOOKUP_TIMING: LookupTiming = {
  budgetMs: 15_000,
  concurrency: 3,
  probeTimeoutMs: 3000,
};

export interface LookupServiceDeps {
  pools: ConnectionPoolManager;
  schemas: SchemaCache;
  send(message: LookupEventMessage): void;
  timing?: LookupTiming;
  limits?: LookupLimits;
}

const LOOKUP_DIALECTS: ReadonlySet<DialectType> = new Set([
  "postgresql",
  "mysql",
  "sqlite",
  "duckdb",
  "tsql",
]);

const HOLDS: Record<LookupValue["kind"], string> = {
  email: "an email",
  integer: "an id",
  uuid: "a UUID",
};

class LookupFailure extends Error {
  readonly code: LookupErrorCode;

  constructor(code: LookupErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const unsupported = (dialect: DialectType | null): LookupFailure =>
  new LookupFailure(
    "UNSUPPORTED_ENGINE",
    dialect === "clickhouse"
      ? "ID lookup isn't available for ClickHouse yet."
      : "ID lookup works with SQL databases."
  );

interface LookupTarget {
  pool: Pool;
  dialect: DialectType;
  database: string;
  schema: SchemaInfo;
}

const shortId = (lookupId: string): string => lookupId.slice(0, 8);

const redacted = (message: string, value: LookupValue): string =>
  message.replaceAll(value.value, "[value]");

const isTimeout = (error: unknown): boolean =>
  error instanceof DbError && error.code === DbError.timeout().code;

// Drivers may ignore the signal; the probe still has to settle on time.
const untilAborted = (signal: AbortSignal): Promise<never> => {
  const { promise, reject } = Promise.withResolvers<never>();
  if (signal.aborted) {
    reject(signal.reason);
  } else {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  }
  return promise;
};

const failureEvent = (error: unknown, signal: AbortSignal): LookupEvent => {
  if (signal.aborted) {
    return {
      code: "CANCELLED",
      message: "The search was stopped.",
      type: "error",
    };
  }
  if (error instanceof LookupFailure) {
    return { code: error.code, message: error.message, type: "error" };
  }
  return {
    code: "FAILED",
    message: DbError.fromUnknown(error).message,
    type: "error",
  };
};

export const createLookupService = ({
  pools,
  schemas,
  send,
  timing = LOOKUP_TIMING,
  limits = DEFAULT_LOOKUP_LIMITS,
}: LookupServiceDeps) => {
  const controllers = new CancellationRegistry();
  const activeByConnection = new Map<string, string>();

  const openTarget = async (request: LookupRequest): Promise<LookupTarget> => {
    const connection = await findConnection(request.connectionId);
    if (!connection) {
      throw new LookupFailure(
        "CONNECTION_MISSING",
        "This connection no longer exists. Pick another one."
      );
    }
    const pool = await ensurePool(pools, connection);
    const { dialect } = pool;
    if (!(dialect && LOOKUP_DIALECTS.has(dialect))) {
      throw unsupported(dialect);
    }
    const database = await resolveSchemaName(
      pool,
      request.database,
      connection
    );
    const schema = await schemas.get(connection.id, database);
    return { database, dialect, pool, schema };
  };

  const runProbes = async (
    request: LookupRequest,
    target: LookupTarget,
    probes: LookupProbe[],
    signal: AbortSignal
  ): Promise<void> => {
    const emit = (event: LookupEvent) =>
      send({ event, lookupId: request.lookupId });
    const { dialect, database, pool } = target;
    const bound = { value: lookupTemplateValue(request.value) };
    let next = 0;
    let done = 0;

    const probe = async (item: LookupProbe): Promise<void> => {
      const compiled = compileSqlTemplate(item.template, bound, dialect);
      const verdict = assertReadOnly(compiled.sql, dialect);
      if (!verdict.ok) {
        throw new LookupFailure("FAILED", verdict.reason);
      }
      const started = performance.now();
      try {
        const result = await raceWithCancel(
          (probeSignal) =>
            Promise.race([
              pool.execute(
                compiled.sql,
                limits.countCap + 1,
                database,
                probeSignal,
                { params: compiled.params, readOnly: true }
              ),
              untilAborted(probeSignal),
            ]),
          { signal, timeoutMs: timing.probeTimeoutMs }
        );
        const rows = tabular(result).rowCount;
        if (rows > 0) {
          emit({
            hit: {
              capped: rows > limits.countCap,
              column: item.column,
              elapsedMs: Math.round(performance.now() - started),
              matchedRows: Math.min(rows, limits.countCap),
              rank: item.rank,
              schema: item.schema,
              table: item.table,
            },
            type: "hit",
          });
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        const timedOut = isTimeout(error);
        if (!timedOut) {
          const { message } = DbError.fromUnknown(error);
          console.error(
            `[lookup] ${shortId(request.lookupId)} probe on ${item.table}.${item.column} failed: ${redacted(message, request.value)}`
          );
        }
        emit({
          column: item.column,
          reason: timedOut ? "timeout" : "error",
          table: item.table,
          type: "probeFailed",
        });
      }
      done += 1;
      emit({ done, total: probes.length, type: "progress" });
    };

    const worker = async (): Promise<void> => {
      while (!signal.aborted && next < probes.length) {
        const item = probes[next];
        next += 1;
        if (item) {
          await probe(item);
        }
      }
    };
    const workers = Math.min(timing.concurrency, probes.length);
    await Promise.all(Array.from({ length: workers }, worker));
  };

  const runLookup = async (
    request: LookupRequest,
    signal: AbortSignal
  ): Promise<void> => {
    const started = performance.now();
    const emit = (event: LookupEvent) =>
      send({ event, lookupId: request.lookupId });
    const budget = new AbortController();
    const budgetTimer = setTimeout(
      () => budget.abort(DbError.timeout()),
      timing.budgetMs
    );
    const bounded = AbortSignal.any([signal, budget.signal]);
    try {
      const target = await openTarget(request);
      const plan = planLookupProbes(
        target.schema,
        request.value,
        target.dialect,
        limits
      );
      if (plan.probes.length === 0) {
        throw new LookupFailure(
          "NO_CANDIDATES",
          `No columns in ${target.database} look like they hold ${HOLDS[request.value.kind]}.`
        );
      }
      emit({
        probes: plan.probes.length,
        skipped: plan.skipped,
        tables: plan.tables,
        type: "planned",
      });
      await runProbes(request, target, plan.probes, bounded);
      if (signal.aborted) {
        throw signal.reason;
      }
      emit({
        budgetExceeded: budget.signal.aborted,
        elapsedMs: Math.round(performance.now() - started),
        type: "done",
      });
    } catch (error) {
      emit(failureEvent(error, signal));
    } finally {
      clearTimeout(budgetTimer);
      budget.abort(DbError.cancelled());
    }
  };

  const runSession = async (request: LookupRequest): Promise<void> => {
    const previous = activeByConnection.get(request.connectionId);
    if (previous) {
      controllers.cancel(previous);
    }
    activeByConnection.set(request.connectionId, request.lookupId);
    const controller = controllers.register(request.lookupId);
    try {
      await runLookup(request, controller.signal);
    } finally {
      controllers.remove(request.lookupId);
      if (activeByConnection.get(request.connectionId) === request.lookupId) {
        activeByConnection.delete(request.connectionId);
      }
    }
  };

  return {
    cancelLookup(lookupId: string): void {
      controllers.cancel(lookupId);
    },
    startLookup(input: unknown): void {
      runSession(LookupRequest.parse(input));
    },
  };
};

export type LookupService = ReturnType<typeof createLookupService>;
