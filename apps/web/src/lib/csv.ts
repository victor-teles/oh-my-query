import type { TabularResult } from "@/lib/tauri";

interface CsvOptions {
  delimiter: string;
  nullDisplay: string;
  includeHeaders: boolean;
  includeBom: boolean;
}

const DEFAULT_OPTIONS: CsvOptions = {
  delimiter: ",",
  includeBom: false,
  includeHeaders: true,
  nullDisplay: "",
};

const escapeCell = (
  value: unknown,
  delimiter: string,
  nullDisplay: string
): string => {
  const str =
    value === null || value === undefined ? nullDisplay : String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

export const tabularResultToCsv = (
  result: TabularResult,
  options: Partial<CsvOptions> = {}
): string => {
  const { delimiter, nullDisplay, includeHeaders, includeBom } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const escape = (v: unknown) => escapeCell(v, delimiter, nullDisplay);

  const rows = result.rows.map((row) => row.map(escape).join(delimiter));

  const lines = includeHeaders
    ? [result.columns.map((col) => escape(col.name)).join(delimiter), ...rows]
    : rows;

  const csv = lines.join("\n");
  return includeBom ? `\uFEFF${csv}` : csv;
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
