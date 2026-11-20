import type { CardResult, FormatContext } from "@oh-my-query/rpc";

import {
  columnValues,
  formatContextFor,
  formatFor,
  isIsoDate,
  toNumber,
} from "@oh-my-query/rpc";

import type {
  CardSpec,
  CardView,
  ChartView,
  ColumnFormat,
  ColumnInfo,
} from "@/lib/ipc";

type PieView = Extract<CardView, { kind: "pie" }>;

export type CardViewKind = "bar" | "line" | "area" | "pie" | "kpi" | "table";

export interface ViewOption {
  kind: CardViewKind;
  label: string;
  view: CardView;
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

export type ChartRow = Record<string, string | number | null>;

export interface ChartData {
  series: Series[];
  rows: ChartRow[];
}

export const X_KEY = "x";
export const MAX_SERIES = 6;
export const OTHER_LABEL = "Other";
const MAX_GROUPS_FOR_INFERENCE = 6;

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const NUMERIC_TYPE =
  /int|numeric|decimal|float|double|real|money|number|serial|hugeint/i;
const ORDERED_NAME = /year|quarter|month|week|day|hour|minute|period|bucket/i;

const VIEW_LABELS: Record<CardViewKind, string> = {
  area: "Area",
  bar: "Bar",
  kpi: "KPI",
  line: "Line",
  pie: "Pie",
  table: "Table",
};

export const seriesColor = (index: number): string =>
  SERIES_COLORS[index % SERIES_COLORS.length] ?? "var(--chart-1)";

export const viewKindOf = (view: CardView): CardViewKind =>
  view.kind === "chart" ? view.mark : view.kind;

export const humanize = (name: string): string => {
  const spaced = name.replaceAll("_", " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

type ResultRows = Pick<CardResult, "columns" | "rows">;

const present = (values: readonly unknown[]): unknown[] =>
  values.filter((value) => value !== null && value !== undefined);

type ColumnKind = "numeric" | "temporal" | "text";

const kindOf = (column: ColumnInfo, values: readonly unknown[]): ColumnKind => {
  const known = present(values);
  if (known.length === 0) {
    return "text";
  }
  const numericType =
    NUMERIC_TYPE.test(column.typeName) ||
    known.every((value) => typeof value === "number");
  if (numericType && known.every((value) => toNumber(value) !== null)) {
    return "numeric";
  }
  return known.every(isIsoDate) ? "temporal" : "text";
};

const EMPTY = "—";

export const isNumericColumn = (result: ResultRows, name: string): boolean => {
  const column = result.columns.find((item) => item.name === name);
  return column
    ? kindOf(column, columnValues(result, name)) === "numeric"
    : false;
};

const xValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "number" ? value : String(value);
};

interface Pivot {
  groups: string[];
  rows: ChartRow[];
}

const groupTotals = (
  groups: readonly unknown[],
  amounts: readonly unknown[]
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const [index, group] of groups.entries()) {
    const name = String(group ?? EMPTY);
    totals.set(name, (totals.get(name) ?? 0) + (toNumber(amounts[index]) ?? 0));
  }
  return totals;
};

const keptGroups = (totals: Map<string, number>): string[] => {
  const ranked = [...totals.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .map(([name]) => name);
  if (ranked.length <= MAX_SERIES) {
    return ranked;
  }
  return [...ranked.slice(0, MAX_SERIES - 1), OTHER_LABEL];
};

export const pivotLongToWide = (
  result: CardResult,
  x: string,
  y: string,
  groupBy: string
): Pivot => {
  const xs = columnValues(result, x);
  const groupValues = columnValues(result, groupBy);
  const amounts = columnValues(result, y);
  const groups = keptGroups(groupTotals(groupValues, amounts));
  const named = new Set(groups);

  const byX = new Map<string, ChartRow>();
  for (const [index, raw] of xs.entries()) {
    const key = String(raw);
    let row = byX.get(key);
    if (!row) {
      row = { [X_KEY]: xValue(raw) };
      byX.set(key, row);
    }
    const name = String(groupValues[index] ?? EMPTY);
    const group = named.has(name) ? name : OTHER_LABEL;
    const amount = toNumber(amounts[index]);
    if (amount !== null) {
      const current = row[group];
      row[group] = (typeof current === "number" ? current : 0) + amount;
    }
  }
  return { groups, rows: [...byX.values()] };
};

export const seriesOf = (view: ChartView, result: CardResult): ChartData => {
  const [firstY] = view.y;
  if (view.groupBy && firstY) {
    const pivot = pivotLongToWide(result, view.x, firstY, view.groupBy);
    const series = pivot.groups.map((group, index) => ({
      color: seriesColor(index),
      key: `s${index}`,
      label: group,
    }));
    const rows = pivot.rows.map((row) => {
      const keyed: ChartRow = { [X_KEY]: row[X_KEY] ?? null };
      for (const [index, group] of pivot.groups.entries()) {
        keyed[`s${index}`] = row[group] ?? null;
      }
      return keyed;
    });
    return { rows, series };
  }

  const ys = view.y.slice(0, MAX_SERIES);
  const series = ys.map((name, index) => ({
    color: seriesColor(index),
    key: `s${index}`,
    label: humanize(name),
  }));
  const xs = columnValues(result, view.x);
  const columns = ys.map((name) => columnValues(result, name));
  const rows = xs.map((raw, rowIndex) => {
    const row: ChartRow = { [X_KEY]: xValue(raw) };
    for (const [index, values] of columns.entries()) {
      row[`s${index}`] = toNumber(values[rowIndex]);
    }
    return row;
  });
  return { rows, series };
};

export const slicesOf = (view: PieView, result: CardResult): ChartData => {
  const totals = groupTotals(
    columnValues(result, view.label),
    columnValues(result, view.value)
  );
  const groups = keptGroups(totals);
  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const named = groups
    .filter((group) => group !== OTHER_LABEL || totals.has(OTHER_LABEL))
    .reduce((sum, group) => sum + (totals.get(group) ?? 0), 0);
  const row: ChartRow = { [X_KEY]: view.value };
  const series = groups.map((group, index) => {
    const folded = group === OTHER_LABEL && !totals.has(OTHER_LABEL);
    row[`s${index}`] = folded ? grand - named : (totals.get(group) ?? null);
    return { color: seriesColor(index), key: `s${index}`, label: group };
  });
  return { rows: [row], series };
};

export interface ChartModel {
  data: ChartData;
  // A series' "latest" value is meaningful along an ordered axis or per pie
  // slice; across unordered categories it would just be the last bar.
  showsLatest: boolean;
  xFormat: ColumnFormat | undefined;
  yFormat: ColumnFormat | undefined;
  context: FormatContext;
}

type Formats = CardSpec["formats"];

const measureFormat = (formats: Formats, name: string, result: CardResult) => ({
  context: formatContextFor(columnValues(result, name)),
  yFormat: formatFor({ formats }, name, columnValues(result, name)),
});

export const chartModelOf = (
  view: ChartView,
  result: CardResult,
  formats: Formats
): ChartModel => ({
  ...measureFormat(formats, view.y[0] ?? "", result),
  data: seriesOf(view, result),
  showsLatest: xIsOrdered(view, result),
  xFormat: formatFor({ formats }, view.x, columnValues(result, view.x)),
});

export const pieModelOf = (
  view: PieView,
  result: CardResult,
  formats: Formats
): ChartModel => ({
  ...measureFormat(formats, view.value, result),
  data: slicesOf(view, result),
  showsLatest: true,
  xFormat: undefined,
});

export const latestValues = (data: ChartData): Map<string, number | null> => {
  const latest = new Map<string, number | null>();
  for (const series of data.series) {
    const last = data.rows.findLast(
      (row) => typeof row[series.key] === "number"
    );
    const value = last?.[series.key];
    latest.set(series.key, typeof value === "number" ? value : null);
  }
  return latest;
};

export const trendOf = (data: ChartData): "up" | "down" | "flat" => {
  const [first] = data.series;
  if (!first) {
    return "flat";
  }
  const values = data.rows
    .map((row) => row[first.key])
    .filter((value): value is number => typeof value === "number");
  const start = values.at(0);
  const end = values.at(-1);
  if (start === undefined || end === undefined || start === end) {
    return "flat";
  }
  return end > start ? "up" : "down";
};

const isOrderedAxis = (
  column: ColumnInfo,
  kind: ColumnKind,
  values: readonly unknown[]
): boolean => {
  if (kind === "temporal") {
    return true;
  }
  if (kind !== "numeric" || !ORDERED_NAME.test(column.name)) {
    return false;
  }
  const numbers = values.map(toNumber);
  return numbers.every(
    (value, index) =>
      index === 0 || (value ?? 0) > (numbers[index - 1] ?? Number.NaN)
  );
};

interface ColumnProfile {
  column: ColumnInfo;
  kind: ColumnKind;
  values: unknown[];
}

const profile = (result: CardResult): ColumnProfile[] =>
  result.columns.map((column) => {
    const values = columnValues(result, column.name);
    return { column, kind: kindOf(column, values), values };
  });

const distinct = (values: readonly unknown[]): number =>
  new Set(present(values).map(String)).size;

export const inferView = (result: CardResult): CardView => {
  const columns = profile(result);
  const numeric = columns.filter((item) => item.kind === "numeric");
  const [onlyNumeric] = numeric;
  if (result.rows.length === 1 && numeric.length === 1 && onlyNumeric) {
    return { kind: "kpi", value: onlyNumeric.column.name };
  }
  const [x, ...rest] = columns;
  const ys = rest.filter((item) => item.kind === "numeric");
  const categories = rest.filter((item) => item.kind !== "numeric");
  const [firstY] = ys;
  if (result.rows.length < 2 || !x || !firstY) {
    return { kind: "table" };
  }
  const ordered = isOrderedAxis(x.column, x.kind, x.values);
  if (!ordered && x.kind !== "text") {
    return { kind: "table" };
  }
  const mark = ordered ? "line" : "bar";
  const base = {
    kind: "chart",
    mark,
    stacked: false,
    x: x.column.name,
  } as const;
  if (categories.length === 0) {
    return {
      ...base,
      y: ys.slice(0, MAX_SERIES).map((item) => item.column.name),
    };
  }
  const [group] = categories;
  if (
    categories.length === 1 &&
    group &&
    distinct(group.values) <= MAX_GROUPS_FOR_INFERENCE
  ) {
    return { ...base, groupBy: group.column.name, y: [firstY.column.name] };
  }
  return { kind: "table" };
};

const option = (kind: CardViewKind, view: CardView): ViewOption => ({
  kind,
  label: VIEW_LABELS[kind],
  view,
});

const xIsOrdered = (view: ChartView, result: CardResult): boolean => {
  const column = result.columns.find((item) => item.name === view.x);
  if (!column) {
    return false;
  }
  const values = columnValues(result, view.x);
  return isOrderedAxis(column, kindOf(column, values), values);
};

const chartOptions = (view: ChartView, result: CardResult): ViewOption[] => {
  const marks: ChartView["mark"][] = xIsOrdered(view, result)
    ? ["bar", view.mark === "area" ? "area" : "line"]
    : ["bar"];
  if (!marks.includes(view.mark)) {
    marks.push(view.mark);
  }
  return marks.map((mark) => option(mark, { ...view, mark }));
};

const tableOf = (spec: CardSpec): CardView =>
  spec.view.kind === "table" ? spec.view : { kind: "table" };

export const alternatesFor = (
  spec: CardSpec,
  result: CardResult
): ViewOption[] => {
  const table = option("table", tableOf(spec));
  const { view } = spec;
  switch (view.kind) {
    case "chart": {
      return [...chartOptions(view, result), table];
    }
    case "pie": {
      const bar: ChartView = {
        kind: "chart",
        mark: "bar",
        stacked: false,
        x: view.label,
        y: [view.value],
      };
      return [option("pie", view), option("bar", bar), table];
    }
    case "kpi": {
      return [option("kpi", view), table];
    }
    default: {
      const inferred = inferView(result);
      if (inferred.kind === "chart") {
        return [table, ...chartOptions(inferred, result)];
      }
      if (inferred.kind === "kpi") {
        return [table, option("kpi", inferred)];
      }
      return [table];
    }
  }
};
