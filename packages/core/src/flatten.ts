import type { ColumnInfo, TabularResult } from "./types.ts";

export interface FlattenOptions {
  maxColumns: number;
  isTruncated: boolean;
}

type Cell = string | number | boolean | null;

interface FlatValue {
  cell: Cell;
  encoded: boolean;
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const scalarOf = (value: unknown): Cell => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const encode = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    typeof nested === "bigint" ? String(nested) : nested
  );

const flatValue = (value: unknown): FlatValue =>
  Array.isArray(value) || isPlainObject(value)
    ? { cell: encode(value), encoded: true }
    : { cell: scalarOf(value), encoded: false };

const flattenRecord = (
  record: Record<string, unknown>
): [string, FlatValue][] =>
  Object.entries(record).flatMap(([key, value]): [string, FlatValue][] => {
    if (!isPlainObject(value) || Object.keys(value).length === 0) {
      return [[key, flatValue(value)]];
    }
    return Object.entries(value).map(([nestedKey, nested]) => [
      `${key}.${nestedKey}`,
      flatValue(nested),
    ]);
  });

const typeNameOf = (values: readonly FlatValue[]): string => {
  const present = values.filter((value) => value.cell !== null);
  if (present.length === 0) {
    return "TEXT";
  }
  if (present.some((value) => value.encoded)) {
    return "JSON";
  }
  if (present.every((value) => typeof value.cell === "number")) {
    return "NUMERIC";
  }
  if (present.every((value) => typeof value.cell === "boolean")) {
    return "BOOLEAN";
  }
  const isDate = (value: FlatValue) =>
    typeof value.cell === "string" && ISO_DATE.test(value.cell);
  return present.every(isDate) ? "TIMESTAMP" : "TEXT";
};

const columnOrder = (
  flattened: readonly Map<string, FlatValue>[],
  maxColumns: number
): string[] => {
  const seen = new Set<string>();
  for (const row of flattened) {
    for (const key of row.keys()) {
      seen.add(key);
    }
  }
  const names = [...seen];
  const idFirst = names.includes("_id")
    ? ["_id", ...names.filter((name) => name !== "_id")]
    : names;
  return idFirst.slice(0, maxColumns);
};

export const flattenRecords = (
  records: readonly Record<string, unknown>[],
  { maxColumns, isTruncated }: FlattenOptions
): TabularResult => {
  const flattened = records.map((record) => new Map(flattenRecord(record)));
  const names = columnOrder(flattened, maxColumns);
  const columns: ColumnInfo[] = names.map((name) => ({
    name,
    typeName: typeNameOf(
      flattened.flatMap((row) => {
        const value = row.get(name);
        return value ? [value] : [];
      })
    ),
  }));
  return {
    columns,
    executionTimeMs: 0,
    isTruncated,
    resultType: "tabular",
    rowCount: flattened.length,
    rows: flattened.map((row) =>
      names.map((name) => row.get(name)?.cell ?? null)
    ),
  };
};
