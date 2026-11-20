import type {
  AskPorts,
  LanguageModel,
  QueryEngine,
  SqlRunInput,
  SqlRunPorts,
} from "@oh-my-query/agent";
import type {
  DatabaseConnection,
  DialectType,
  Pool,
  QueryLanguage,
  SchemaInfo,
} from "@oh-my-query/core";
import type { ConnectionPoolManager } from "@oh-my-query/drivers";
import type {
  AskErrorCode,
  AskEvent,
  AskEventMessage,
  AskParams,
  AskPhase,
  RecentAsk,
  SqlRunSource,
} from "@oh-my-query/rpc";

import {
  ASK_MAX_ROWS,
  mongoEngine,
  redisEngine,
  runAsk,
  runSql,
  sqlEngine,
} from "@oh-my-query/agent";
import {
  appendHistory,
  CancellationRegistry,
  compileSqlTemplate,
  DbError,
  limitedSelect,
  lookupKindFits,
  lookupTemplateValue,
  PREVIEW_ROWS,
  qualifiedTable,
  quoteIdentifier,
} from "@oh-my-query/core";
import {
  isMongoPool,
  isRedisPool,
  runMongoReadQuery,
  runRedisReadPlan,
} from "@oh-my-query/drivers/read";
import { chainPrompt, RefineContext, RunSqlParams } from "@oh-my-query/rpc";
import { z } from "zod";

import type { SchemaCache } from "./schema-cache.ts";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
  SQL_RUN_UNSUPPORTED_MESSAGE,
  tabular,
  UNSUPPORTED_ENGINE_MESSAGE,
} from "./connection-access.ts";

const askParamsSchema = z.object({
  askId: z.string().min(1).max(100),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  prompt: z.string().trim().min(1).max(4000),
  refine: RefineContext.optional(),
});

export interface AskServiceDeps {
  pools: ConnectionPoolManager;
  schemas: SchemaCache;
  loadModel(): Promise<LanguageModel | null>;
  send(message: AskEventMessage): void;
  rememberAsk(ask: RecentAsk): Promise<void>;
}

class SetupFailure extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const requireConnection = async (id: string): Promise<DatabaseConnection> => {
  const connection = await findConnection(id);
  if (!connection) {
    throw new SetupFailure(
      "QUERY_FAILED",
      "This connection no longer exists. Pick another one."
    );
  }
  return connection;
};

interface OpenPool {
  connection: DatabaseConnection;
  pool: Pool;
  database: string;
}

type RunQuery = AskPorts["execute"];

const recordHistory = async (
  { connection, database }: OpenPool,
  language: QueryLanguage,
  entry: { sql: string; error: string | null; executionTimeMs: number }
): Promise<void> => {
  try {
    await appendHistory({
      ...entry,
      connectionId: connection.id,
      database,
      dialect: language,
      success: entry.error === null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[ask] could not record history: ${String(error)}`);
  }
};

const shortId = (askId: string): string => askId.slice(0, 8);

const withHistory =
  (open: OpenPool, language: QueryLanguage, run: RunQuery): RunQuery =>
  async (sql, signal, params) => {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const result = await run(sql, signal, params);
      await recordHistory(open, language, {
        error: null,
        executionTimeMs: elapsed(),
        sql,
      });
      return result;
    } catch (error) {
      await recordHistory(open, language, {
        error: DbError.fromUnknown(error).message,
        executionTimeMs: elapsed(),
        sql,
      });
      throw error;
    }
  };

const sqlRunner =
  ({ pool, database }: OpenPool): RunQuery =>
  async (sql, signal, params) =>
    tabular(
      await pool.execute(
        sql,
        ASK_MAX_ROWS,
        database,
        signal,
        params ? { params, readOnly: true } : { readOnly: true }
      )
    );

interface AskEngine {
  engine: QueryEngine;
  run: RunQuery;
}

const askEngineOf = (open: OpenPool): AskEngine | null => {
  const { pool, database } = open;
  if (pool.dialect) {
    return { engine: sqlEngine(pool.dialect), run: sqlRunner(open) };
  }
  if (isMongoPool(pool)) {
    return {
      engine: mongoEngine,
      run: (text, signal) =>
        runMongoReadQuery(pool, text, database, ASK_MAX_ROWS, signal),
    };
  }
  if (isRedisPool(pool)) {
    return {
      engine: redisEngine,
      run: (text, signal) =>
        runRedisReadPlan(pool, text, database, ASK_MAX_ROWS, signal),
    };
  }
  return null;
};

interface QueryTarget {
  connection: DatabaseConnection;
  dialect: DialectType;
  database: string;
  ports: SqlRunPorts;
}

type MatchSource = Extract<SqlRunSource, { kind: "match" }>;

const TABLE_CHANGED = "This table changed since the search. Search again.";

const matchRunInput = (
  source: MatchSource,
  schema: SchemaInfo,
  dialect: SqlRunPorts["dialect"]
): SqlRunInput => {
  const table = schema.schemas
    .find((item) => item.name === source.schema)
    ?.tables.find((item) => item.name === source.table);
  const column = table?.columns.find((item) => item.name === source.column);
  if (
    !(column && lookupKindFits(source.value.kind, column.dataType, dialect))
  ) {
    throw new SetupFailure("QUERY_FAILED", TABLE_CHANGED);
  }
  const template = limitedSelect(
    dialect,
    qualifiedTable(dialect, source.schema, source.table),
    "*",
    PREVIEW_ROWS,
    `${quoteIdentifier(dialect, source.column)} = {{value}}`
  );
  const { sql, params } = compileSqlTemplate(
    template,
    { value: lookupTemplateValue(source.value) },
    dialect
  );
  return { params, sql, title: `${source.table} · ${source.column}` };
};

const toSetupFailure = (error: unknown): SetupFailure =>
  error instanceof SetupFailure
    ? error
    : new SetupFailure("QUERY_FAILED", DbError.fromUnknown(error).message);

export const createAskService = (deps: AskServiceDeps) => {
  const controllers = new CancellationRegistry();
  const activeByConnection = new Map<string, string>();

  const openPool = async (
    connectionId: string,
    requested: string | null
  ): Promise<OpenPool> => {
    const connection = await requireConnection(connectionId);
    const pool = await ensurePool(deps.pools, connection);
    const database = await resolveSchemaName(pool, requested, connection);
    return { connection, database, pool };
  };

  const openSqlTarget = async (
    connectionId: string,
    requested: string | null
  ): Promise<QueryTarget> => {
    const open = await openPool(connectionId, requested);
    const { dialect } = open.pool;
    if (!dialect) {
      throw new SetupFailure("UNSUPPORTED_ENGINE", SQL_RUN_UNSUPPORTED_MESSAGE);
    }
    const execute = withHistory(open, dialect, sqlRunner(open));
    return {
      connection: open.connection,
      database: open.database,
      dialect,
      ports: { connectionLabel: open.connection.name, dialect, execute },
    };
  };

  const buildAskPorts = async (params: AskParams): Promise<AskPorts> => {
    const open = await openPool(params.connectionId, params.database);
    const selected = askEngineOf(open);
    if (!selected) {
      throw new SetupFailure("UNSUPPORTED_ENGINE", UNSUPPORTED_ENGINE_MESSAGE);
    }
    const model = await deps.loadModel();
    if (!model) {
      throw new SetupFailure(
        "NO_AI_SETTINGS",
        "Add an AI provider in Settings to ask questions."
      );
    }
    const { connection, database } = open;
    const { engine, run } = selected;
    return {
      connectionLabel: connection.name,
      engine,
      execute: withHistory(open, engine.language, run),
      loadSchema: () => deps.schemas.get(connection.id, database),
      model,
      now: () => new Date(),
      redact: {
        customPatterns: connection.customPiiPatterns ?? [],
        enabled: Boolean(connection.piiRedaction),
      },
    };
  };

  const forward = (askId: string, event: AskEvent, started: number): void => {
    if (
      event.type === "phase" ||
      event.type === "done" ||
      event.type === "error"
    ) {
      const label = event.type === "phase" ? event.phase : event.type;
      const code = event.type === "error" ? ` ${event.code}` : "";
      const ms = Math.round(performance.now() - started);
      console.log(`[ask] ${shortId(askId)} ${label}${code} +${ms}ms`);
    }
    deps.send({ askId, event });
  };

  const forwardSetupError = (
    askId: string,
    error: unknown,
    phase: AskPhase,
    signal: AbortSignal,
    started: number
  ): void => {
    const failure = toSetupFailure(error);
    const code = signal.aborted ? "CANCELLED" : failure.code;
    forward(
      askId,
      { code, message: failure.message, phase, type: "error" },
      started
    );
  };

  const remember = async (ask: RecentAsk): Promise<void> => {
    try {
      await deps.rememberAsk(ask);
    } catch (error) {
      console.error(`[ask] could not record the recent ask: ${String(error)}`);
    }
  };

  const runQuestion = async (
    params: AskParams,
    signal: AbortSignal
  ): Promise<void> => {
    const started = performance.now();
    let ports: AskPorts;
    try {
      ports = await buildAskPorts(params);
    } catch (error) {
      forwardSetupError(params.askId, error, "schema", signal, started);
      return;
    }
    let sql = "";
    const { refine } = params;
    for await (const event of runAsk(params.prompt, ports, signal, refine)) {
      forward(params.askId, event, started);
      if (event.type === "sqlDone") {
        ({ sql } = event);
      } else if (event.type === "card") {
        await remember({
          askedAt: new Date().toISOString(),
          connectionId: params.connectionId,
          database: params.database,
          dialect: ports.engine.language,
          id: refine?.chainId ?? params.askId,
          prompt: chainPrompt(refine?.turns ?? [], params.prompt),
          spec: event.spec,
          sql,
        });
      }
    }
  };

  const runInputFor = async (
    source: SqlRunSource,
    target: QueryTarget
  ): Promise<SqlRunInput> => {
    if (source.kind === "sql") {
      return { sql: source.sql, title: source.title };
    }
    const schema = await deps.schemas.get(
      target.connection.id,
      target.database
    );
    return matchRunInput(source, schema, target.dialect);
  };

  const runRawSql = async (
    params: RunSqlParams,
    signal: AbortSignal
  ): Promise<void> => {
    const started = performance.now();
    let target: QueryTarget;
    let input: SqlRunInput;
    try {
      target = await openSqlTarget(params.connectionId, params.database);
      input = await runInputFor(params.source, target);
    } catch (error) {
      forwardSetupError(params.askId, error, "run", signal, started);
      return;
    }
    for await (const event of runSql(input, target.ports, signal)) {
      forward(params.askId, event, started);
    }
  };

  const runSession = async (
    session: { askId: string; connectionId: string },
    work: (signal: AbortSignal) => Promise<void>
  ): Promise<void> => {
    const previous = activeByConnection.get(session.connectionId);
    if (previous) {
      controllers.cancel(previous);
    }
    activeByConnection.set(session.connectionId, session.askId);
    const controller = controllers.register(session.askId);
    try {
      await work(controller.signal);
    } catch (error) {
      console.error(
        `[ask] ${shortId(session.askId)} crashed: ${String(error)}`
      );
    } finally {
      controllers.remove(session.askId);
      if (activeByConnection.get(session.connectionId) === session.askId) {
        activeByConnection.delete(session.connectionId);
      }
    }
  };

  return {
    cancelAsk(askId: string): void {
      controllers.cancel(askId);
    },
    startAsk(input: AskParams): void {
      const params = askParamsSchema.parse(input);
      runSession(params, (signal) => runQuestion(params, signal));
    },
    startSqlRun(input: RunSqlParams): void {
      const params = RunSqlParams.parse(input);
      runSession(params, (signal) => runRawSql(params, signal));
    },
  };
};
