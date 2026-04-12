import { safeGetJson, safeSetJson } from "@/lib/safe-storage";

export type CsvDelimiter = "," | ";" | "\t" | "|";

export interface ExportSettings {
  csvDelimiter: CsvDelimiter;
  includeBom: boolean;
  nullDisplay: string;
  includeHeaders: boolean;
}

const STORAGE_KEY = "oh-my-query-export-settings";

const DEFAULT_SETTINGS: ExportSettings = {
  csvDelimiter: ",",
  includeBom: false,
  includeHeaders: true,
  nullDisplay: "",
};

export const CSV_DELIMITERS = [
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Tab (\\t)", value: "\t" },
  { label: "Pipe (|)", value: "|" },
] as const;

export const NULL_DISPLAY_PRESETS = [
  { label: "Empty string", value: "" },
  { label: "NULL (uppercase)", value: "NULL" },
  { label: "null (lowercase)", value: "null" },
] as const;

export const getExportSettings = (): ExportSettings => ({
  ...DEFAULT_SETTINGS,
  ...safeGetJson<Partial<ExportSettings>>(STORAGE_KEY, {}),
});

export const saveExportSettings = (settings: ExportSettings): void => {
  safeSetJson(STORAGE_KEY, settings);
};
