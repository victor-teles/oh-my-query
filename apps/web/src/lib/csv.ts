import type { TabularResult } from "@/lib/tauri";

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

export const tabularResultToCsv = (result: TabularResult): string => {
  const header = result.columns.map((col) => escapeCell(col.name)).join(",");
  const rows = result.rows.map((row) =>
    row.map((cell) => escapeCell(cell)).join(",")
  );
  return [header, ...rows].join("\n");
};

export const downloadCsv = (csv: string, filename: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
