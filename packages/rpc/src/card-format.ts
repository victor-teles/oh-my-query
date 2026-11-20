import type { ColumnInfo } from "@conch/core/client";

import type { CardSpec, ColumnFormat } from "./card-spec.ts";

export interface CardResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  rowCount: number;
  isTruncated: boolean;
}

type ResultRows = Pick<CardResult, "columns" | "rows">;

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;
const MONTH_START =
  /^\d{4}-\d{2}-01(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/;

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && ISO_DATE.test(value);

export const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const columnValues = (result: ResultRows, name: string): unknown[] => {
  const index = result.columns.findIndex((column) => column.name === name);
  return index === -1 ? [] : result.rows.map((row) => row[index]);
};

const present = (values: readonly unknown[]): unknown[] =>
  values.filter((value) => value !== null && value !== undefined);

const isMonthly = (values: readonly unknown[]): boolean =>
  present(values).every(
    (value) => typeof value === "string" && MONTH_START.test(value)
  );

export const formatFor = (
  spec: Pick<CardSpec, "formats">,
  name: string,
  values: readonly unknown[]
): ColumnFormat | undefined => {
  const declared = spec.formats[name];
  if (declared) {
    return declared;
  }
  const known = present(values);
  const temporal = known.length > 0 && known.every(isIsoDate);
  if (!temporal) {
    return undefined;
  }
  return { kind: isMonthly(values) ? "month" : "date" };
};

export interface FormatContext {
  percentScale: 1 | 100;
}

const DEFAULT_CONTEXT: FormatContext = { percentScale: 1 };

export const formatContextFor = (values: readonly unknown[]): FormatContext => {
  const numbers = present(values)
    .map(toNumber)
    .filter((value): value is number => value !== null);
  const fractions =
    numbers.length > 0 && numbers.every((value) => Math.abs(value) <= 1);
  return { percentScale: fractions ? 100 : 1 };
};

const UNITS: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

const compact = (value: number): string => {
  const magnitude = Math.abs(value);
  for (const [size, suffix] of UNITS) {
    if (magnitude >= size) {
      const scaled = value / size;
      const digits = Math.abs(scaled) < 100 ? 1 : 0;
      return `${Number(scaled.toFixed(digits))}${suffix}`;
    }
  }
  return plainNumber(value, 2);
};

const plainNumber = (value: number, maxDigits: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDigits }).format(
    value
  );

const currencySymbol = (code: string): string => {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      currency: code,
      currencyDisplay: "narrowSymbol",
      style: "currency",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? `${code} `;
  } catch {
    return `${code} `;
  }
};

const COMPACT_CURRENCY_FROM = 10_000;

const currency = (value: number, code: string, forceCompact: boolean) => {
  const symbol = currencySymbol(code);
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);
  const body =
    forceCompact || magnitude >= COMPACT_CURRENCY_FROM
      ? compact(magnitude)
      : plainNumber(magnitude, 2);
  return `${sign}${symbol}${body}`;
};

const MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});
const DAY = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const asDate = (value: unknown): Date | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const EMPTY = "—";

const formatNumeric = (
  value: number,
  format: ColumnFormat | undefined,
  context: FormatContext,
  tick: boolean
): string => {
  switch (format?.kind) {
    case "currency": {
      return currency(value, format.currency ?? "USD", tick);
    }
    case "percent": {
      const percent = value * context.percentScale;
      return `${plainNumber(percent, tick ? 0 : 1)}%`;
    }
    case "integer": {
      return tick ? compact(value) : plainNumber(Math.round(value), 0);
    }
    case "compact": {
      return compact(value);
    }
    default: {
      return tick ? compact(value) : plainNumber(value, 2);
    }
  }
};

const formatTemporal = (
  value: unknown,
  kind: "date" | "month",
  tick: boolean
): string => {
  const date = asDate(value);
  if (!date) {
    return String(value);
  }
  if (kind === "month") {
    return (tick ? MONTH : MONTH_YEAR).format(date);
  }
  return (tick ? DAY : DAY_YEAR).format(date);
};

const format = (
  value: unknown,
  columnFormat: ColumnFormat | undefined,
  context: FormatContext,
  tick: boolean
): string => {
  if (value === null || value === undefined || value === "") {
    return EMPTY;
  }
  const kind = columnFormat?.kind;
  if (kind === "date" || kind === "month") {
    return formatTemporal(value, kind, tick);
  }
  if (kind === "text") {
    return String(value);
  }
  const number = toNumber(value);
  if (number === null || typeof value === "boolean") {
    return String(value);
  }
  return formatNumeric(number, columnFormat, context, tick);
};

export const formatValue = (
  value: unknown,
  columnFormat?: ColumnFormat,
  context: FormatContext = DEFAULT_CONTEXT
): string => format(value, columnFormat, context, false);

export const formatTick = (
  value: unknown,
  columnFormat?: ColumnFormat,
  context: FormatContext = DEFAULT_CONTEXT
): string => format(value, columnFormat, context, true);

export interface Scalar {
  value: number;
  column: string;
}

const scalarColumnOf = (
  spec: Pick<CardSpec, "view">,
  result: ResultRows
): string | null => {
  if (spec.view.kind === "kpi") {
    return spec.view.value;
  }
  const [only] = result.columns;
  return result.rows.length === 1 && result.columns.length === 1 && only
    ? only.name
    : null;
};

// The number a widget "is" for the menu bar, thresholds and trends.
export const scalarOf = (
  spec: Pick<CardSpec, "view">,
  result: ResultRows
): Scalar | null => {
  const column = scalarColumnOf(spec, result);
  if (column === null) {
    return null;
  }
  const [cell] = columnValues(result, column);
  const value = typeof cell === "boolean" ? null : toNumber(cell);
  return value === null ? null : { column, value };
};

export const scalarColumn = (spec: Pick<CardSpec, "view">): string | null =>
  spec.view.kind === "kpi" ? spec.view.value : null;

export const formatScalarValue = (
  spec: Pick<CardSpec, "formats" | "view">,
  value: number,
  column: string | null = scalarColumn(spec)
): string =>
  formatTick(
    value,
    column === null ? undefined : formatFor(spec, column, [value]),
    formatContextFor([value])
  );

export const formatScalar = (
  spec: Pick<CardSpec, "formats" | "view">,
  result: ResultRows
): string | null => {
  const scalar = scalarOf(spec, result);
  return scalar ? formatScalarValue(spec, scalar.value, scalar.column) : null;
};
