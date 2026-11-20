import type { TableItem } from "@conch/core/client";

const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const compactLong = new Intl.NumberFormat("en-US", {
  compactDisplay: "long",
  maximumFractionDigits: 1,
  notation: "compact",
});

export const rowEstimateLabel = (rowEstimate: number | null): string =>
  rowEstimate === null
    ? "rows unknown"
    : `~${compact.format(rowEstimate)} rows`;

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const columnCountLabel = (table: TableItem): string =>
  plural(table.columns.length, "column");

export const foreignTargets = (table: TableItem): Map<string, string> => {
  const targets = new Map<string, string>();
  for (const key of table.foreignKeys) {
    for (const [index, column] of key.columns.entries()) {
      const referenced = key.referencedColumns[index];
      if (referenced) {
        targets.set(column, `${key.referencedTable}.${referenced}`);
      }
    }
  }
  return targets;
};

export const tableSummary = (table: TableItem): string => {
  const parts = [
    table.name,
    columnCountLabel(table),
    table.rowEstimate === null
      ? "row count unknown"
      : `about ${compactLong.format(table.rowEstimate)} rows`,
  ];
  const keys = table.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => column.name);
  if (keys.length > 0) {
    parts.push(`primary key ${keys.join(", ")}`);
  }
  return parts.join(", ");
};
