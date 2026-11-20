import type { LanguageModel } from "@conch/agent";
import type {
  BindValue,
  DatabaseConnection,
  DialectType,
  Pool,
  TemplateValue,
} from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type {
  CardResult,
  ParamDef,
  ParamValues,
  ProposeParamsRequest,
  ProposeParamsResult,
  RecentAsk as RecentAskRecord,
  RunSample,
  RunWidgetRequest,
  Widget as WidgetRecord,
  WidgetDraft as WidgetDraftRecord,
  WidgetRunResult,
  WidgetTrend,
} from "@conch/rpc";

import { assertReadOnly, proposeParams } from "@conch/agent";
import {
  CancellationRegistry,
  compileSqlTemplate,
  createRecentAskStore,
  createRunLogStore,
  createWidgetStore,
  DbError,
  maskTemplateInputs,
  raceWithCancel,
} from "@conch/core";
import {
  Dialect,
  editableParams,
  MAX_RUN_LOG_ENTRIES_PER_WIDGET,
  MAX_SAMPLES,
  MAX_SELECT_OPTIONS,
  paramValueSchema,
  RecentAsk,
  RunLogEntry,
  toTemplateValue,
  trendOfEntry,
  Widget,
  WidgetDraft,
} from "@conch/rpc";
import { z } from "zod";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
  tabular,
} from "./connection-access.ts";
import { sampleOf, valuesKeyOf } from "./run-samples.ts";

export const WIDGET_MAX_ROWS = 2000;
const WIDGET_TIMEOUT_MS = 30_000;
const OPTIONS_TTL_MS = 60_000;

const runRequestSchema = z.object({
  runId: z.string().min(1).max(100),
  values: z.record(z.string(), z.unknown()),
  widgetId: z.string().min(1).max(100),
});

const proposeRequestSchema = z.object({
  dialect: Dialect,
  prompt: z.string().max(4000),
  sql: z.string().trim().min(1).max(20_000),
});

const listRecentRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
});

const askIdSchema = z.string().min(1).max(100);

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): T | null => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };

export type WidgetStore = ReturnType<typeof createWidgetStore<WidgetRecord>>;
export type RecentAskStore = ReturnType<
  typeof createRecentAskStore<RecentAskRecord>
>;

export type RunLogStore = ReturnType<typeof createRunLogStore<RunSample>>;

export const defaultWidgetStore = (): WidgetStore =>
  createWidgetStore(parseWith(Widget));
export const defaultRecentAskStore = (): RecentAskStore =>
  createRecentAskStore(parseWith(RecentAsk));
export const defaultRunLogStore = (): RunLogStore =>
  createRunLogStore(parseWith(RunLogEntry), {
    maxEntriesPerWidget: MAX_RUN_LOG_ENTRIES_PER_WIDGET,
    maxSamples: MAX_SAMPLES,
  });

export interface WidgetServiceDeps {
  pools: ConnectionPoolManager;
  widgets: WidgetStore;
  recents: RecentAskStore;
  runLog: RunLogStore;
  loadModel(): Promise<LanguageModel | null>;
  now(): Date;
  onSampled(widgetId: string, valuesKey: string): void;
}

export interface DetachedRun {
  widget: WidgetRecord;
  result: CardResult;
  compiledSql: string;
  values: ParamValues;
  valuesKey: string;
  sample: RunSample;
  previous: RunSample | null;
}

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const guardTemplate = (template: string, dialect: DialectType): void => {
  const verdict = assertReadOnly(
    maskTemplateInputs(template, dialect, "NULL"),
    dialect
  );
  if (!verdict.ok) {
    throw failure("NOT_READ_ONLY", verdict.reason);
  }
};

const templateValues = (
  params: readonly ParamDef[],
  values: ParamValues,
  now: Date
): Record<string, TemplateValue> =>
  Object.fromEntries(
    params.map((param) => [
      param.name,
      toTemplateValue(param, values[param.name] ?? param.default, now),
    ])
  );

const keptValues = (
  params: readonly ParamDef[],
  values: ParamValues
): ParamValues =>
  Object.fromEntries(
    params.flatMap((param) => {
      const value = values[param.name];
      return value !== undefined &&
        paramValueSchema(param).safeParse(value).success
        ? [[param.name, value]]
        : [];
    })
  );

const rawValues = (
  params: readonly ParamDef[],
  requested: Record<string, unknown>,
  fallback: ParamValues
): Record<string, unknown> =>
  Object.fromEntries(
    params.map((param) => [
      param.name,
      param.fixed
        ? param.default
        : (requested[param.name] ?? fallback[param.name] ?? param.default),
    ])
  );

const editableNames = (widget: WidgetRecord): Set<string> =>
  new Set(editableParams(widget.params).map((param) => param.name));

// A watch snapshots its inputs, so a background run drops inputs the widget
// no longer has and never falls back to the last interactive values.
const detachedValues = (
  widget: WidgetRecord,
  values: ParamValues
): Record<string, unknown> => {
  const names = editableNames(widget);
  const kept = Object.fromEntries(
    Object.entries(values).filter(([name]) => names.has(name))
  );
  return rawValues(widget.params, kept, {});
};

const byRecency = (a: WidgetRecord, b: WidgetRecord): number =>
  (b.lastRunAt ?? b.createdAt).localeCompare(a.lastRunAt ?? a.createdAt);

const firstColumnStrings = (rows: unknown[][]): string[] => [
  ...new Set(
    rows
      .map((row) => row[0])
      .filter((cell) => cell !== null && cell !== undefined)
      .map(String)
  ),
];

export const createWidgetService = (deps: WidgetServiceDeps) => {
  const runs = new CancellationRegistry();
  const optionCache = new Map<string, { options: string[]; at: number }>();

  const requireWidget = async (id: string): Promise<WidgetRecord> => {
    const widget = await deps.widgets.getWidget(id);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const openConnection = async (
    widget: WidgetRecord
  ): Promise<{
    connection: DatabaseConnection;
    pool: Pool;
    schema: string;
  }> => {
    const connection = await findConnection(widget.connectionId);
    if (!connection) {
      throw failure(
        "CONNECTION_MISSING",
        "This widget's connection no longer exists. Choose a connection to run it on."
      );
    }
    const pool = await ensurePool(deps.pools, connection);
    if (!pool.dialect) {
      throw failure(
        "UNSUPPORTED_ENGINE",
        "Widgets work with SQL databases for now."
      );
    }
    const schema = await resolveSchemaName(pool, widget.database, connection);
    return { connection, pool, schema };
  };

  const runReadOnly = (
    pool: Pool,
    sql: string,
    options: { schema: string; maxRows: number; params?: BindValue[] },
    signal: AbortSignal
  ) =>
    raceWithCancel(
      async (merged) => {
        const started = performance.now();
        const result = tabular(
          await pool.execute(sql, options.maxRows, options.schema, merged, {
            params: options.params,
            readOnly: true,
          })
        );
        const executionTimeMs = Math.round(performance.now() - started);
        return { ...result, executionTimeMs };
      },
      { signal, timeoutMs: WIDGET_TIMEOUT_MS }
    );

  const queryOptions = async (
    widget: WidgetRecord,
    param: ParamDef & { type: "select" }
  ): Promise<string[]> => {
    if (!param.optionsSql) {
      return param.options ?? [];
    }
    const key = `${widget.id}:${param.name}`;
    const cached = optionCache.get(key);
    if (cached && Date.now() - cached.at < OPTIONS_TTL_MS) {
      return cached.options;
    }
    const verdict = assertReadOnly(param.optionsSql, widget.dialect);
    if (!verdict.ok) {
      throw failure("NOT_READ_ONLY", verdict.reason);
    }
    const { pool, schema } = await openConnection(widget);
    const result = await runReadOnly(
      pool,
      param.optionsSql,
      { maxRows: MAX_SELECT_OPTIONS, schema },
      new AbortController().signal
    );
    const options = firstColumnStrings(result.rows);
    optionCache.set(key, { at: Date.now(), options });
    return options;
  };

  const rejectStray = (
    widget: WidgetRecord,
    requested: Record<string, unknown>
  ): void => {
    const names = editableNames(widget);
    const stray = Object.keys(requested).filter((name) => !names.has(name));
    if (stray.length > 0) {
      throw failure("INVALID_INPUT", `Unknown input: ${stray.join(", ")}.`);
    }
  };

  const resolveValues = async (
    widget: WidgetRecord,
    raws: Record<string, unknown>
  ): Promise<ParamValues> => {
    const resolved: ParamValues = {};
    for (const param of widget.params) {
      const raw = raws[param.name];
      const allowed =
        param.type === "select" && param.optionsSql
          ? await queryOptions(widget, param)
          : undefined;
      const parsed = paramValueSchema(param, allowed).safeParse(raw);
      if (!parsed.success) {
        throw failure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
        );
      }
      resolved[param.name] = parsed.data;
    }
    return resolved;
  };

  const execute = async (
    widget: WidgetRecord,
    raws: Record<string, unknown>,
    now: Date,
    signal: AbortSignal
  ) => {
    const { pool, schema } = await openConnection(widget);
    const resolved = await resolveValues(widget, raws);
    guardTemplate(widget.sqlTemplate, widget.dialect);
    const compiled = compileSqlTemplate(
      widget.sqlTemplate,
      templateValues(widget.params, resolved, now),
      widget.dialect
    );
    const result = await runReadOnly(
      pool,
      compiled.sql,
      { maxRows: WIDGET_MAX_ROWS, params: compiled.params, schema },
      signal
    );
    return { compiledSql: compiled.sql, resolved, result };
  };

  const appendSample = async (
    widget: WidgetRecord,
    valuesKey: string,
    sample: RunSample
  ) => {
    try {
      const entry = await deps.runLog.append(widget.id, valuesKey, sample);
      deps.onSampled(widget.id, valuesKey);
      return entry;
    } catch (error) {
      console.error(
        `[widgets] could not record a run of ${widget.id}: ${String(error)}`
      );
      return null;
    }
  };

  const checkDraft = (draft: WidgetDraftRecord): void => {
    guardTemplate(draft.sqlTemplate, draft.dialect);
    try {
      compileSqlTemplate(
        draft.sqlTemplate,
        templateValues(draft.params, {}, deps.now()),
        draft.dialect
      );
    } catch (error) {
      throw failure("INVALID_TEMPLATE", DbError.fromUnknown(error).message);
    }
  };

  return {
    cancelRun(runId: string): void {
      runs.cancel(runId);
    },

    clearRecentAsks: () => deps.recents.clearRecentAsks(),

    async deleteRecentAsk(askId: string): Promise<void> {
      await deps.recents.removeRecentAsk(askIdSchema.parse(askId));
    },

    async deleteWidget(widgetId: string): Promise<void> {
      const id = z.string().min(1).parse(widgetId);
      await deps.widgets.deleteWidget(id);
      await deps.runLog.removeForWidget(id);
    },

    async lastSampleFor(
      widgetId: string,
      values: ParamValues
    ): Promise<RunSample | null> {
      const widget = await deps.widgets.getWidget(widgetId);
      if (!widget) {
        return null;
      }
      const key = valuesKeyOf(detachedValues(widget, values));
      const entry = await deps.runLog.entry(widget.id, key);
      return entry?.samples.at(-1) ?? null;
    },

    async listRecentAsks(
      request: { limit?: number } = {}
    ): Promise<RecentAskRecord[]> {
      const { limit } = listRecentRequestSchema.parse(request);
      return await deps.recents.listRecentAsks(limit);
    },

    async listWidgetTrends(
      widgetIds: readonly string[]
    ): Promise<Record<string, WidgetTrend>> {
      const ids = z.array(z.string().min(1).max(100)).max(500).parse(widgetIds);
      const latest = await deps.runLog.latestFor(ids);
      return Object.fromEntries(
        Object.entries(latest).map(([id, entry]) => [id, trendOfEntry(entry)])
      );
    },

    async listWidgets(): Promise<WidgetRecord[]> {
      const widgets = await deps.widgets.listWidgets();
      return widgets.toSorted(byRecency);
    },

    async loadParamOptions(
      widgetId: string,
      paramName: string
    ): Promise<string[]> {
      const widget = await requireWidget(widgetId);
      const param = widget.params.find((item) => item.name === paramName);
      if (param?.type !== "select") {
        throw failure("INVALID_INPUT", `"${paramName}" has no options.`);
      }
      return queryOptions(widget, param);
    },

    async proposeParams(
      request: ProposeParamsRequest
    ): Promise<ProposeParamsResult> {
      const { sql, prompt, dialect } = proposeRequestSchema.parse(request);
      const model = await deps.loadModel();
      if (!model) {
        return { error: "Add an AI provider in Settings to find inputs." };
      }
      return proposeParams({
        dialect,
        model,
        now: deps.now(),
        prompt,
        signal: AbortSignal.timeout(WIDGET_TIMEOUT_MS),
        sql,
      });
    },

    rememberAsk: (ask: RecentAskRecord) => deps.recents.pushRecentAsk(ask),

    async runDetached(
      widgetId: string,
      values: ParamValues,
      signal: AbortSignal
    ): Promise<DetachedRun> {
      const widget = await requireWidget(widgetId);
      const now = deps.now();
      const { compiledSql, resolved, result } = await execute(
        widget,
        detachedValues(widget, values),
        now,
        signal
      );
      const valuesKey = valuesKeyOf(resolved);
      const sample = sampleOf(widget.spec, result, now);
      const entry = await appendSample(widget, valuesKey, sample);
      return {
        compiledSql,
        previous: entry?.samples.at(-2) ?? null,
        result,
        sample,
        values: resolved,
        valuesKey,
        widget,
      };
    },

    async runWidget(request: RunWidgetRequest): Promise<WidgetRunResult> {
      const { runId, values, widgetId } = runRequestSchema.parse(request);
      const widget = await requireWidget(widgetId);
      rejectStray(widget, values);
      const now = deps.now();
      const controller = runs.register(runId);
      try {
        const { compiledSql, resolved, result } = await execute(
          widget,
          rawValues(widget.params, values, widget.lastValues),
          now,
          controller.signal
        );
        await deps.widgets.updateWidget(widget.id, (current) => ({
          ...current,
          lastRunAt: now.toISOString(),
          lastValues: resolved,
        }));
        const entry = await appendSample(
          widget,
          valuesKeyOf(resolved),
          sampleOf(widget.spec, result, now)
        );
        return {
          compiledSql,
          result,
          trend: entry ? trendOfEntry(entry) : null,
          values: resolved,
        };
      } finally {
        runs.remove(runId);
      }
    },

    async saveWidget(input: WidgetDraftRecord): Promise<WidgetRecord> {
      const draft = WidgetDraft.parse(input);
      checkDraft(draft);
      const existing = draft.id ? await deps.widgets.getWidget(draft.id) : null;
      const stamp = deps.now().toISOString();
      const widget = Widget.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        id: draft.id ?? crypto.randomUUID(),
        lastRunAt: existing?.lastRunAt ?? null,
        lastValues: keptValues(draft.params, draft.lastValues),
        updatedAt: stamp,
      });
      return deps.widgets.saveWidget(widget);
    },
  };
};

export type WidgetService = ReturnType<typeof createWidgetService>;
