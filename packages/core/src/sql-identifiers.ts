import type { DialectType } from "./types.ts";

import { DbError } from "./error.ts";

type QuoteStyle = "double" | "backtick" | "bracket";

const QUOTE_STYLES: Record<DialectType, QuoteStyle> = {
  bigquery: "backtick",
  clickhouse: "backtick",
  duckdb: "double",
  mysql: "backtick",
  oracle: "double",
  postgresql: "double",
  redshift: "double",
  snowflake: "double",
  sqlite: "double",
  tsql: "bracket",
};

const quoteWith = (style: QuoteStyle, name: string): string => {
  switch (style) {
    case "backtick": {
      return `\`${name.replaceAll("`", "``")}\``;
    }
    case "bracket": {
      return `[${name.replaceAll("]", "]]")}]`;
    }
    default: {
      return `"${name.replaceAll('"', '""')}"`;
    }
  }
};

export const quoteIdentifier = (dialect: DialectType, name: string): string => {
  if (name === "" || name.includes("\0")) {
    throw new DbError("INVALID_IDENTIFIER", "That name can't be used in SQL.");
  }
  return quoteWith(QUOTE_STYLES[dialect], name);
};

export const qualifiedTable = (
  dialect: DialectType,
  schema: string | null,
  table: string
): string => {
  const quotedTable = quoteIdentifier(dialect, table);
  return schema === null
    ? quotedTable
    : `${quoteIdentifier(dialect, schema)}.${quotedTable}`;
};

export const limitedSelect = (
  dialect: DialectType,
  from: string,
  columns: "*" | "1",
  limit: number,
  where?: string
): string => {
  if (!(Number.isSafeInteger(limit) && limit > 0)) {
    throw new DbError(
      "INVALID_LIMIT",
      "The row limit must be a positive whole number."
    );
  }
  const filter = where ? ` WHERE ${where}` : "";
  switch (dialect) {
    case "tsql": {
      return `SELECT TOP (${limit}) ${columns} FROM ${from}${filter}`;
    }
    case "oracle": {
      return `SELECT ${columns} FROM ${from}${filter} FETCH FIRST ${limit} ROWS ONLY`;
    }
    default: {
      return `SELECT ${columns} FROM ${from}${filter} LIMIT ${limit}`;
    }
  }
};

export const PREVIEW_ROWS = 50;

export const previewSql = (
  dialect: DialectType,
  schema: string | null,
  table: string,
  limit = PREVIEW_ROWS
): string =>
  limitedSelect(dialect, qualifiedTable(dialect, schema, table), "*", limit);
