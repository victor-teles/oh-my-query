import type {
  DialectType,
  TabularResult,
  TemplateValue,
} from "@oh-my-query/core/client";

import {
  DATE_PRESETS,
  RANGE_PRESETS,
  resolveDatePreset,
  resolvePreset,
} from "@oh-my-query/core/client";
import { z } from "zod";

import { CardSpec } from "./card-spec.ts";

export const MAX_WIDGET_PARAMS = 6;
export const MAX_TEXT_VALUE = 200;
export const MAX_SELECT_OPTIONS = 200;

export const Ident = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
export const DatePreset = z.enum(DATE_PRESETS);
export const RangePreset = z.enum(RANGE_PRESETS);
export const IsoDate = z.iso.date();
export const IsoRange = z
  .object({ from: IsoDate, to: IsoDate })
  .refine((range) => range.from < range.to, {
    message: "The range must end after it starts.",
  });

export const DIALECTS = [
  "postgresql",
  "mysql",
  "sqlite",
  "clickhouse",
  "duckdb",
  "tsql",
  "snowflake",
  "bigquery",
  "redshift",
  "oracle",
] as const satisfies readonly DialectType[];
export const Dialect = z.enum(DIALECTS);

export const CARD_VIEW_KINDS = [
  "bar",
  "line",
  "area",
  "pie",
  "kpi",
  "table",
] as const;
export const CardViewKind = z.enum(CARD_VIEW_KINDS);
export type CardViewKind = z.infer<typeof CardViewKind>;

const Label = z.string().trim().min(1).max(40);

// A fixed input keeps its default bound as a parameter but is no longer shown
// or editable; removing an input never splices its value into the SQL.
const Fixed = z.boolean().optional();

const DateParam = z.object({
  default: DatePreset.or(IsoDate),
  fixed: Fixed,
  label: Label,
  name: Ident,
  type: z.literal("date"),
});

const DateRangeParam = z.object({
  default: RangePreset.or(IsoRange),
  fixed: Fixed,
  label: Label,
  name: Ident,
  type: z.literal("dateRange"),
});

const NumberParam = z.object({
  default: z.number().finite(),
  fixed: Fixed,
  label: Label,
  max: z.number().finite().optional(),
  min: z.number().finite().optional(),
  name: Ident,
  type: z.literal("number"),
});

const TextParam = z.object({
  default: z.string().max(MAX_TEXT_VALUE),
  fixed: Fixed,
  label: Label,
  name: Ident,
  type: z.literal("text"),
});

const SelectParam = z.object({
  default: z.string().max(MAX_TEXT_VALUE),
  fixed: Fixed,
  label: Label,
  name: Ident,
  options: z
    .array(z.string().max(MAX_TEXT_VALUE))
    .max(MAX_SELECT_OPTIONS)
    .optional(),
  optionsSql: z.string().max(4000).optional(),
  type: z.literal("select"),
});

export const ParamDef = z
  .discriminatedUnion("type", [
    DateParam,
    DateRangeParam,
    NumberParam,
    TextParam,
    SelectParam,
  ])
  .superRefine((def, ctx) => {
    const issue = defaultProblem(def);
    if (issue) {
      ctx.addIssue({ code: "custom", message: issue, path: ["default"] });
    }
  });

export type ParamDef = z.infer<typeof ParamDef>;

export const editableParams = (params: readonly ParamDef[]): ParamDef[] =>
  params.filter((param) => !param.fixed);
export type ParamType = ParamDef["type"];

export const ParamValue = z.union([
  z.string().max(MAX_TEXT_VALUE),
  z.number().finite(),
  IsoRange,
]);
export type ParamValue = z.infer<typeof ParamValue>;
export type ParamValues = Record<string, ParamValue>;

function numberProblem(
  def: { min?: number; max?: number; label: string },
  value: number
): string | null {
  if (def.min !== undefined && value < def.min) {
    return `${def.label} must be at least ${def.min}.`;
  }
  if (def.max !== undefined && value > def.max) {
    return `${def.label} must be at most ${def.max}.`;
  }
  return null;
}

function defaultProblem(def: ParamDef): string | null {
  if (def.type === "number") {
    return numberProblem(def, def.default);
  }
  if (
    def.type === "select" &&
    def.options &&
    !def.options.includes(def.default)
  ) {
    return `${def.label} must default to one of its options.`;
  }
  return null;
}

export const paramValueSchema = (
  def: ParamDef,
  allowedOptions?: readonly string[]
) => {
  switch (def.type) {
    case "date": {
      return DatePreset.or(IsoDate);
    }
    case "dateRange": {
      return RangePreset.or(IsoRange);
    }
    case "number": {
      return z
        .number()
        .finite()
        .superRefine((value, ctx) => {
          const problem = numberProblem(def, value);
          if (problem) {
            ctx.addIssue({ code: "custom", message: problem });
          }
        });
    }
    case "text": {
      return z.string().max(MAX_TEXT_VALUE);
    }
    case "select": {
      const options = allowedOptions ?? def.options;
      return z
        .string()
        .max(MAX_TEXT_VALUE)
        .refine((value) => !options || options.includes(value), {
          message: `Pick one of the ${def.label} options.`,
        });
    }
    default: {
      throw new Error(`Unknown input type ${def satisfies never}`);
    }
  }
};

export const toTemplateValue = (
  def: ParamDef,
  value: ParamValue,
  now: Date
): TemplateValue => {
  switch (def.type) {
    case "date": {
      const parsed = DatePreset.safeParse(value);
      return {
        kind: "date",
        value: parsed.success
          ? resolveDatePreset(parsed.data, now)
          : IsoDate.parse(value),
      };
    }
    case "dateRange": {
      const parsed = RangePreset.safeParse(value);
      const range = parsed.success
        ? resolvePreset(parsed.data, now)
        : IsoRange.parse(value);
      return { from: range.from, kind: "dateRange", to: range.to };
    }
    case "number": {
      return { kind: "number", value: z.number().parse(value) };
    }
    case "text":
    case "select": {
      return { kind: "text", value: z.string().parse(value) };
    }
    default: {
      throw new Error(`Unknown input type ${def satisfies never}`);
    }
  }
};

const uniqueNames = (params: readonly ParamDef[]): boolean =>
  new Set(params.map((param) => param.name)).size === params.length;

export const Widget = z.object({
  connectionId: z.string().min(1).max(200),
  createdAt: z.string(),
  database: z.string().max(500).nullable(),
  dialect: Dialect,
  id: z.string().min(1).max(100),
  lastRunAt: z.string().nullable(),
  lastValues: z.record(z.string(), ParamValue),
  name: z.string().trim().min(1).max(60),
  params: z
    .array(ParamDef)
    .max(MAX_WIDGET_PARAMS)
    .refine(uniqueNames, { message: "Input names must be unique." }),
  prompt: z.string().max(4000),
  spec: CardSpec,
  sqlTemplate: z.string().min(1).max(20_000),
  updatedAt: z.string(),
  view: CardViewKind,
});
export type Widget = z.infer<typeof Widget>;

export const WidgetDraft = Widget.omit({
  createdAt: true,
  id: true,
  lastRunAt: true,
  updatedAt: true,
}).extend({ id: z.string().min(1).max(100).optional() });
export type WidgetDraft = z.infer<typeof WidgetDraft>;

export const RecentAsk = z.object({
  askedAt: z.string(),
  connectionId: z.string(),
  database: z.string().nullable(),
  dialect: Dialect,
  id: z.string(),
  prompt: z.string(),
  spec: CardSpec,
  sql: z.string(),
});
export type RecentAsk = z.infer<typeof RecentAsk>;

export type ProposeParamsResult =
  | { template: string; params: ParamDef[] }
  | { error: string };

export interface ProposeParamsRequest {
  sql: string;
  prompt: string;
  dialect: DialectType;
}

export interface RunWidgetRequest {
  widgetId: string;
  values: ParamValues;
  runId: string;
}

export interface WidgetRunResult {
  result: TabularResult;
  compiledSql: string;
  values: ParamValues;
}
