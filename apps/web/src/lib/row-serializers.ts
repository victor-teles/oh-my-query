import type { ColumnInfo, TabularResult } from "@/lib/tauri";

import { tabularResultToCsv } from "@/lib/csv";

export interface RowSlice {
  columns: ColumnInfo[];
  rows: unknown[][];
}

interface CsvOptions {
  delimiter: string;
  nullDisplay: string;
  includeHeaders: boolean;
  includeBom: boolean;
}

const sliceToResult = (slice: RowSlice): TabularResult => ({
  columns: slice.columns,
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: slice.rows.length,
  rows: slice.rows,
});

export const rowsToCsv = (slice: RowSlice, options: CsvOptions): string =>
  tabularResultToCsv(sliceToResult(slice), options);

export const rowsToTsv = (slice: RowSlice): string =>
  tabularResultToCsv(sliceToResult(slice), {
    delimiter: "\t",
    includeBom: false,
    includeHeaders: true,
    nullDisplay: "",
  });

export const rowsToJson = (slice: RowSlice): string => {
  const objects = slice.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [i, col] of slice.columns.entries()) {
      obj[col.name] = row[i] ?? null;
    }
    return obj;
  });
  return JSON.stringify(objects, null, 2);
};

const formatSqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  // Simple single-quote doubling. Display-only — not injection-safe.
  const str = String(value).replaceAll("'", "''");
  return `'${str}'`;
};

export const rowsToInserts = (
  slice: RowSlice,
  tableName = "table_name"
): string => {
  const columnList = slice.columns.map((col) => col.name).join(", ");
  return slice.rows
    .map((row) => {
      const values = row.map(formatSqlLiteral).join(", ");
      return `INSERT INTO ${tableName} (${columnList}) VALUES (${values});`;
    })
    .join("\n");
};

const TABLE_NAME_REGEX =
  /\bfrom\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z_][\w$.]*)/i;

export const extractTableName = (sql: string | null): string | null => {
  if (!sql) {
    return null;
  }
  const match = TABLE_NAME_REGEX.exec(sql);
  const [, raw] = match ?? [];
  if (!raw) {
    return null;
  }
  const [first] = raw;
  const last = raw.at(-1);
  if (
    (first === '"' && last === '"') ||
    (first === "`" && last === "`") ||
    (first === "[" && last === "]")
  ) {
    return raw.slice(1, -1);
  }
  return raw;
};

const escapeMarkdownCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br/>");
};

export const rowsToMarkdown = (slice: RowSlice): string => {
  const header = `| ${slice.columns.map((col) => escapeMarkdownCell(col.name)).join(" | ")} |`;
  const separator = `| ${slice.columns.map(() => "---").join(" | ")} |`;
  if (slice.rows.length === 0) {
    return `${header}\n${separator}`;
  }
  const body = slice.rows
    .map((row) => `| ${row.map(escapeMarkdownCell).join(" | ")} |`)
    .join("\n");
  return `${header}\n${separator}\n${body}`;
};
