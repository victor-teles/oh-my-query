import { z } from "zod";

export const CARD_SPEC_VERSION = 1;

export const COLUMN_FORMAT_KINDS = [
  "number",
  "integer",
  "percent",
  "currency",
  "compact",
  "date",
  "month",
  "text",
] as const;

export const CHART_MARKS = ["bar", "line", "area"] as const;

export const ColumnFormat = z.object({
  currency: z.string().length(3).optional(),
  kind: z.enum(COLUMN_FORMAT_KINDS),
});

export const ChartView = z
  .object({
    groupBy: z.string().optional(),
    kind: z.literal("chart"),
    mark: z.enum(CHART_MARKS),
    stacked: z.boolean().default(false),
    x: z.string(),
    y: z.array(z.string()).min(1).max(6),
  })
  .superRefine((view, ctx) => {
    if (view.groupBy !== undefined && view.y.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "groupBy pivots a single y column",
        path: ["groupBy"],
      });
    }
  });

export const PieView = z.object({
  kind: z.literal("pie"),
  label: z.string(),
  value: z.string(),
});

export const KpiView = z.object({
  delta: z.string().optional(),
  kind: z.literal("kpi"),
  label: z.string().optional(),
  value: z.string(),
});

export const TableView = z.object({
  columns: z.array(z.string()).optional(),
  kind: z.literal("table"),
});

export const CardView = z.discriminatedUnion("kind", [
  ChartView,
  PieView,
  KpiView,
  TableView,
]);

export const CardSpec = z.object({
  formats: z.record(z.string(), ColumnFormat).default({}),
  insight: z.string().max(280).optional(),
  subtitle: z.string().max(120).optional(),
  title: z.string().max(80),
  version: z.literal(CARD_SPEC_VERSION),
  view: CardView,
});

export type ColumnFormat = z.infer<typeof ColumnFormat>;
export type ColumnFormatKind = ColumnFormat["kind"];
export type ChartView = z.infer<typeof ChartView>;
export type PieView = z.infer<typeof PieView>;
export type KpiView = z.infer<typeof KpiView>;
export type TableView = z.infer<typeof TableView>;
export type CardView = z.infer<typeof CardView>;
export type CardSpec = z.infer<typeof CardSpec>;
