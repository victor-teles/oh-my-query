import type { SchemaInfo, TableItem } from "@oh-my-query/core/client";

import { fuzzyMatch } from "@/lib/fuzzy-match";

export const MAX_TABLES_SHOWN = 50;

export interface CatalogTable {
  id: string;
  schema: string;
  table: TableItem;
}

export const tableItemId = (schema: string, table: string): string =>
  `table-${schema}.${table}`;

export const catalogTables = (schema: SchemaInfo): CatalogTable[] =>
  schema.schemas.flatMap((group) =>
    group.tables.map((table) => ({
      id: tableItemId(group.name, table.name),
      schema: group.name,
      table,
    }))
  );

const EXACT = 3;
const PREFIX = 2;
const FUZZY = 1;

const nameScore = (name: string, needle: string): number | null => {
  const lowerName = name.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  if (lowerName === lowerNeedle) {
    return EXACT * 1000;
  }
  if (lowerName.startsWith(lowerNeedle)) {
    return PREFIX * 1000 - name.length;
  }
  const fuzzy = fuzzyMatch(name, needle);
  return fuzzy ? FUZZY * 1000 + Math.min(fuzzy.score, 999) - 1000 : null;
};

const scoreOf = (entry: CatalogTable, needle: string): number | null => {
  const dot = needle.indexOf(".");
  if (dot === -1) {
    return nameScore(entry.table.name, needle);
  }
  const schemaScore = nameScore(entry.schema, needle.slice(0, dot));
  const tableNeedle = needle.slice(dot + 1);
  const tableScore = tableNeedle ? nameScore(entry.table.name, tableNeedle) : 0;
  return schemaScore === null || tableScore === null
    ? null
    : schemaScore + tableScore;
};

export const searchTables = (
  tables: readonly CatalogTable[],
  needle: string
): CatalogTable[] => {
  const trimmed = needle.trim();
  if (!trimmed) {
    return tables.slice(0, MAX_TABLES_SHOWN);
  }
  return tables
    .map((entry) => ({ entry, score: scoreOf(entry, trimmed) }))
    .filter(
      (scored): scored is { entry: CatalogTable; score: number } =>
        scored.score !== null
    )
    .toSorted(
      (a, b) =>
        b.score - a.score ||
        a.entry.table.name.localeCompare(b.entry.table.name)
    )
    .slice(0, MAX_TABLES_SHOWN)
    .map((scored) => scored.entry);
};
