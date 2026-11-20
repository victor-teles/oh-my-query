import type {
  AskParams,
  ParamDef,
  ParamValues,
  ProposeParamsResult,
  RecentAsk as RecentAskRecord,
  RunWidgetRequest,
  Widget as WidgetRecord,
  WidgetDraft as WidgetDraftRecord,
  WidgetRunResult,
} from "@conch/rpc";

import { compileSqlTemplate } from "@conch/core/client";
import {
  chainPrompt,
  paramValueSchema,
  RecentAsk,
  toTemplateValue,
  Widget,
  WidgetDraft,
} from "@conch/rpc";

import type { RecordedAsk } from "@/lib/browser-ask-stub";

import {
  MONTHS,
  REGION_MRR,
  REGION_REVENUE,
  regionRevenue,
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
} from "@/lib/browser-ask-stub";

const WIDGETS_KEY = "conch-widgets";
const RECENTS_KEY = "conch-recent-asks";
const MAX_RECENTS = 200;
const RUN_MS = 420;
const PROPOSE_MS = 700;
const REGIONS = REGION_MRR.map(([name]) => name).toSorted();

const readList = <T>(key: string, parse: (raw: unknown) => T | null): T[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.flatMap((raw) => {
          const item = parse(raw);
          return item ? [item] : [];
        })
      : [];
  } catch {
    return [];
  }
};

const parseWidget = (raw: unknown) => Widget.safeParse(raw).data ?? null;
const parseRecent = (raw: unknown) => RecentAsk.safeParse(raw).data ?? null;

const readWidgets = () => readList(WIDGETS_KEY, parseWidget);
const writeWidgets = (widgets: WidgetRecord[]) =>
  localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code, name: "DbError" });

const wait = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

const REGION_TEMPLATE = REGION_REVENUE.sql
  .replace("'Europe'", "{{region}}")
  .replace("date '2026-01-01'", "{{period.from}}::date")
  .replace("date '2026-10-01'", "{{period.to}}::date");

const REGION_PARAMS: ParamDef[] = [
  {
    default: "Europe",
    label: "Region",
    name: "region",
    optionsSql: "select distinct name from regions order by 1 limit 200",
    type: "select",
  },
  {
    default: { from: "2026-01-01", to: "2026-10-01" },
    label: "Period",
    name: "period",
    type: "dateRange",
  },
];

const proposalFor = (sql: string): ProposeParamsResult => {
  if (sql.trim() === REGION_REVENUE.sql.trim()) {
    return { params: REGION_PARAMS, template: REGION_TEMPLATE };
  }
  return { params: [], template: sql };
};

const monthsWithin = (from: string, to: string) =>
  MONTHS.filter((month) => month >= from && month < to);

const recordedFor = (widget: WidgetRecord): RecordedAsk => {
  if (widget.sqlTemplate.includes("{{region}}")) {
    return REGION_REVENUE;
  }
  return widget.sqlTemplate.includes("plans")
    ? WEEKLY_SIGNUPS
    : REVENUE_BY_REGION;
};

const rowsFor = (
  widget: WidgetRecord,
  values: ParamValues,
  now: Date
): unknown[][] => {
  const recorded = recordedFor(widget);
  if (recorded !== REGION_REVENUE) {
    return recorded.rows;
  }
  const period = widget.params.find((param) => param.name === "period");
  const range =
    period && values.period !== undefined
      ? toTemplateValue(period, values.period, now)
      : null;
  const months =
    range?.kind === "dateRange" ? monthsWithin(range.from, range.to) : MONTHS;
  return regionRevenue(String(values.region ?? "Europe"), months);
};

const resolveValues = (
  widget: WidgetRecord,
  requested: ParamValues
): ParamValues =>
  Object.fromEntries(
    widget.params.map((param) => {
      const raw =
        requested[param.name] ?? widget.lastValues[param.name] ?? param.default;
      const allowed = param.type === "select" ? REGIONS : undefined;
      const parsed = paramValueSchema(param, allowed).safeParse(raw);
      if (!parsed.success) {
        throw failure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
        );
      }
      return [param.name, parsed.data];
    })
  );

const compiledFor = (widget: WidgetRecord, values: ParamValues, now: Date) =>
  compileSqlTemplate(
    widget.sqlTemplate,
    Object.fromEntries(
      widget.params.map((param) => [
        param.name,
        toTemplateValue(param, values[param.name] ?? param.default, now),
      ])
    ),
    widget.dialect
  ).sql;

export const createWidgetEmulator = (now: () => Date = () => new Date()) => {
  const requireWidget = (id: string): WidgetRecord => {
    const widget = readWidgets().find((item) => item.id === id);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const update = (id: string, change: (widget: WidgetRecord) => WidgetRecord) =>
    writeWidgets(
      readWidgets().map((widget) =>
        widget.id === id ? change(widget) : widget
      )
    );

  return {
    clearRecentAsks: () => localStorage.setItem(RECENTS_KEY, "[]"),

    deleteRecentAsk: ({ askId }: { askId: string }) =>
      localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify(
          readList(RECENTS_KEY, parseRecent).filter((ask) => ask.id !== askId)
        )
      ),

    deleteWidget: ({ widgetId }: { widgetId: string }) =>
      writeWidgets(readWidgets().filter((widget) => widget.id !== widgetId)),

    listRecentAsks: ({ limit }: { limit?: number } = {}) =>
      readList(RECENTS_KEY, parseRecent).slice(0, limit),

    listWidgets: () =>
      readWidgets().toSorted((a, b) =>
        (b.lastRunAt ?? b.createdAt).localeCompare(a.lastRunAt ?? a.createdAt)
      ),

    loadParamOptions: async () => {
      await wait(RUN_MS / 2);
      return REGIONS;
    },

    proposeWidgetParams: async ({ sql }: { sql: string }) => {
      await wait(PROPOSE_MS);
      return proposalFor(sql);
    },

    rememberAsk: (params: AskParams, recorded: RecordedAsk) => {
      const id = params.refine?.chainId ?? params.askId;
      const prompt = chainPrompt(params.refine?.turns ?? [], params.prompt);
      const recents = readList(RECENTS_KEY, parseRecent).filter(
        (ask) =>
          ask.id !== id &&
          !(
            ask.connectionId === params.connectionId &&
            ask.prompt.toLowerCase() === prompt.toLowerCase()
          )
      );
      const ask: RecentAskRecord = {
        askedAt: now().toISOString(),
        connectionId: params.connectionId,
        database: params.database,
        dialect: "postgresql",
        id,
        prompt,
        spec: recorded.spec,
        sql: recorded.sql,
      };
      localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify([ask, ...recents].slice(0, MAX_RECENTS))
      );
    },

    runWidget: async ({
      widgetId,
      values,
    }: RunWidgetRequest): Promise<WidgetRunResult> => {
      const widget = requireWidget(widgetId);
      const resolved = resolveValues(widget, values);
      await wait(RUN_MS);
      const recorded = recordedFor(widget);
      const rows = rowsFor(widget, resolved, now());
      update(widgetId, (current) => ({
        ...current,
        lastRunAt: now().toISOString(),
        lastValues: resolved,
      }));
      return {
        compiledSql: compiledFor(widget, resolved, now()),
        result: {
          columns: recorded.columns,
          executionTimeMs: recorded.executionTimeMs,
          isTruncated: false,
          resultType: "tabular",
          rowCount: rows.length,
          rows,
        },
        values: resolved,
      };
    },

    saveWidget: ({ widget: input }: { widget: WidgetDraftRecord }) => {
      const draft = WidgetDraft.parse(input);
      const widgets = readWidgets();
      const existing = widgets.find((widget) => widget.id === draft.id);
      const stamp = now().toISOString();
      const widget = Widget.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        id: draft.id ?? crypto.randomUUID(),
        lastRunAt: existing?.lastRunAt ?? null,
        updatedAt: stamp,
      });
      writeWidgets([
        ...widgets.filter((item) => item.id !== widget.id),
        widget,
      ]);
      return widget;
    },
  };
};
