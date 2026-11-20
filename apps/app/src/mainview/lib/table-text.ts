import type { TabularResult } from "@/lib/ipc";

import { isNumericColumn } from "@/lib/card-data";

export type TableLike = Pick<TabularResult, "columns" | "rows">;

const BOM = "﻿";
const NEEDS_QUOTES = /[",\r\n]/;
const LINE_BREAKS = /\r\n|\r|\n/g;
const TABS_AND_BREAKS = /\t|\r\n|\r|\n/g;
const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const MAX_BASE_NAME = 60;
export const FALLBACK_BASE_NAME = "conch-result";

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const csvCell = (value: unknown): string => {
  const text = cellText(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const headerOf = (table: TableLike): string[] =>
  table.columns.map((column) => column.name);

export type CsvTarget = "file" | "clipboard";

// Files get CRLF and a BOM so Excel reads UTF-8; pasted text stays plain.
export const toCsv = (table: TableLike, target: CsvTarget): string => {
  const lines = [headerOf(table), ...table.rows].map((row) =>
    row.map(csvCell).join(",")
  );
  return target === "file" ? `${BOM}${lines.join("\r\n")}` : lines.join("\n");
};

const tsvCell = (value: unknown): string =>
  cellText(value).replaceAll(TABS_AND_BREAKS, " ");

export const toTsv = (table: TableLike): string =>
  [headerOf(table), ...table.rows]
    .map((row) => row.map(tsvCell).join("\t"))
    .join("\n");

const markdownCell = (value: unknown): string =>
  cellText(value).replaceAll("|", "\\|").replaceAll(LINE_BREAKS, "<br>");

const markdownRow = (cells: readonly string[]): string =>
  `| ${cells.join(" | ")} |`;

export const toMarkdown = (table: TableLike): string => {
  const separator = table.columns.map((column) =>
    isNumericColumn(table, column.name) ? "---:" : "---"
  );
  return [
    markdownRow(headerOf(table).map(markdownCell)),
    markdownRow(separator),
    ...table.rows.map((row) => markdownRow(row.map(markdownCell))),
  ].join("\n");
};

export const exportBaseName = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replaceAll(NON_SLUG, "-")
    .slice(0, MAX_BASE_NAME)
    .replaceAll(EDGE_DASHES, "");
  return slug || FALLBACK_BASE_NAME;
};
