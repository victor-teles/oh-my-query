import type { CardSpec, CardView, ColumnFormat } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";

import type { ColumnStats, TabularData } from "./column-stats.ts";

import { computeColumnStats } from "./column-stats.ts";

export const TITLE_MAX = 80;
export const SUBTITLE_MAX = 120;
const MAX_SERIES = 6;
const MAX_GROUPS = 6;

const LEADING_COMMENT = /^\s*--\s*(.+)$/m;
const CURRENCY_NAME = /revenue|mrr|amount|price/i;
// Minor units would read as dollars under a currency format.
const MINOR_UNITS = /_cents$/i;
const PERCENT_NAME = /_pct$|(?:^|_)rate(?:_|$)/i;
const ORDERED_NAME = /year|quarter|month|week|day|hour|minute|period|bucket/i;

export const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

export const titleFor = (sql: string, prompt: string): string => {
  const comment = LEADING_COMMENT.exec(sql)?.[1]?.trim();
  return clip(capitalize(comment || prompt.trim()), TITLE_MAX);
};

const isAscending = (stats: ColumnStats, data: TabularData, index: number) => {
  const values = data.rows.map((row) => Number(row[index]));
  return (
    stats.kind === "numeric" &&
    values.every((value, i) => i === 0 || value > (values[i - 1] ?? value))
  );
};

const isOrderedAxis = (
  stats: ColumnStats,
  data: TabularData,
  index: number
): boolean =>
  stats.kind === "temporal" ||
  (ORDERED_NAME.test(stats.name) && isAscending(stats, data, index));

const formatFor = (stats: ColumnStats): ColumnFormat | null => {
  if (stats.kind === "temporal") {
    return { kind: stats.monthStarts ? "month" : "date" };
  }
  if (stats.kind !== "numeric") {
    return null;
  }
  if (CURRENCY_NAME.test(stats.name) && !MINOR_UNITS.test(stats.name)) {
    return { currency: "USD", kind: "currency" };
  }
  if (PERCENT_NAME.test(stats.name)) {
    return { kind: "percent" };
  }
  return null;
};

const inferFormats = (stats: ColumnStats[]): Record<string, ColumnFormat> => {
  const formats: Record<string, ColumnFormat> = {};
  for (const column of stats) {
    const format = formatFor(column);
    if (format) {
      formats[column.name] = format;
    }
  }
  return formats;
};

const inferChart = (
  stats: ColumnStats[],
  data: TabularData
): CardView | null => {
  const [x, ...rest] = stats;
  const numeric = rest.filter((column) => column.kind === "numeric");
  const categories = rest.filter((column) => column.kind !== "numeric");
  const [firstNumeric] = numeric;
  if (!(x && firstNumeric)) {
    return null;
  }

  const ordered = isOrderedAxis(x, data, 0);
  if (!ordered && x.kind !== "text") {
    return null;
  }
  const mark = ordered ? "line" : "bar";
  if (categories.length === 0) {
    const y = numeric.slice(0, MAX_SERIES).map((column) => column.name);
    return { kind: "chart", mark, stacked: false, x: x.name, y };
  }

  const [group] = categories;
  if (categories.length === 1 && group && group.distinct <= MAX_GROUPS) {
    return {
      groupBy: group.name,
      kind: "chart",
      mark,
      stacked: false,
      x: x.name,
      y: [firstNumeric.name],
    };
  }
  return null;
};

const inferView = (stats: ColumnStats[], data: TabularData): CardView => {
  const numeric = stats.filter((column) => column.kind === "numeric");
  const [onlyNumeric] = numeric;
  if (data.rows.length === 1 && numeric.length === 1 && onlyNumeric) {
    return { kind: "kpi", value: onlyNumeric.name };
  }
  if (data.rows.length > 1) {
    const chart = inferChart(stats, data);
    if (chart) {
      return chart;
    }
  }
  return { kind: "table" };
};

export interface InferContext {
  prompt: string;
  sql: string;
}

export const inferCardSpec = (
  data: TabularData,
  context: InferContext
): CardSpec => {
  const stats = computeColumnStats(data);
  return {
    formats: inferFormats(stats),
    title: titleFor(context.sql, context.prompt),
    version: CARD_SPEC_VERSION,
    view: inferView(stats, data),
  };
};
