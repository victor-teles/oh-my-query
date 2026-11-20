import type { ColumnInfo } from "@oh-my-query/core";

interface BaseStats {
  name: string;
  typeName: string;
  distinct: number;
  nulls: number;
}

export interface NumericStats extends BaseStats {
  kind: "numeric";
  min: number;
  max: number;
  first: number;
  last: number;
  sum: number;
}

export interface TemporalStats extends BaseStats {
  kind: "temporal";
  from: string;
  to: string;
  monthStarts: boolean;
}

export interface TextStats extends BaseStats {
  kind: "text";
}

export type ColumnStats = NumericStats | TemporalStats | TextStats;

export interface TabularData {
  columns: ColumnInfo[];
  rows: unknown[][];
}

const NUMERIC_TYPE =
  /int|numeric|decimal|float|double|real|money|number|serial|hugeint/i;
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;
const MONTH_START =
  /^\d{4}-\d{2}-01(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const numericValues = (
  values: unknown[],
  typeName: string
): number[] | null => {
  const allNumbers = values.every((value) => typeof value === "number");
  if (!(allNumbers || NUMERIC_TYPE.test(typeName))) {
    return null;
  }
  const numbers = values
    .map(toFiniteNumber)
    .filter((value): value is number => value !== null);
  return numbers.length === values.length ? numbers : null;
};

const isIsoDates = (values: unknown[]): values is string[] =>
  values.every((value) => typeof value === "string" && ISO_DATE.test(value));

const distinctCount = (values: unknown[]): number =>
  new Set(values.map((value) => JSON.stringify(value))).size;

const columnStats = (column: ColumnInfo, cells: unknown[]): ColumnStats => {
  const values = cells.filter((value) => value !== null && value !== undefined);
  const base: BaseStats = {
    distinct: distinctCount(values),
    name: column.name,
    nulls: cells.length - values.length,
    typeName: column.typeName,
  };

  const numbers =
    values.length > 0 ? numericValues(values, column.typeName) : null;
  const firstNumber = numbers?.[0];
  const lastNumber = numbers?.at(-1);
  if (numbers && firstNumber !== undefined && lastNumber !== undefined) {
    return {
      ...base,
      first: firstNumber,
      kind: "numeric",
      last: lastNumber,
      max: Math.max(...numbers),
      min: Math.min(...numbers),
      sum: numbers.reduce((total, value) => total + value, 0),
    };
  }

  if (values.length > 0 && isIsoDates(values)) {
    const dates = values.toSorted();
    return {
      ...base,
      from: dates[0] ?? "",
      kind: "temporal",
      monthStarts: dates.every((value) => MONTH_START.test(value)),
      to: dates.at(-1) ?? "",
    };
  }

  return { ...base, kind: "text" };
};

export const computeColumnStats = (data: TabularData): ColumnStats[] =>
  data.columns.map((column, index) =>
    columnStats(
      column,
      data.rows.map((row) => row[index])
    )
  );
