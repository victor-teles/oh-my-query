import { beforeEach, describe, expect, it } from "vitest";

import {
  CSV_DELIMITERS,
  getExportSettings,
  NULL_DISPLAY_PRESETS,
  saveExportSettings,
} from "@/lib/export-settings";

const STORAGE_KEY = "oh-my-query-export-settings";

describe("export settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes a non-empty list of CSV delimiters and null presets", () => {
    expect(CSV_DELIMITERS.length).toBeGreaterThan(0);
    expect(NULL_DISPLAY_PRESETS.length).toBeGreaterThan(0);
  });

  it("returns defaults when no settings are stored", () => {
    expect(getExportSettings()).toStrictEqual({
      csvDelimiter: ",",
      includeBom: false,
      includeHeaders: true,
      nullDisplay: "",
    });
  });

  it("merges stored partial settings with defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ csvDelimiter: ";", includeBom: true })
    );
    expect(getExportSettings()).toStrictEqual({
      csvDelimiter: ";",
      includeBom: true,
      includeHeaders: true,
      nullDisplay: "",
    });
  });

  it("falls back to defaults when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(getExportSettings()).toStrictEqual({
      csvDelimiter: ",",
      includeBom: false,
      includeHeaders: true,
      nullDisplay: "",
    });
  });

  it("round-trips via save → get", () => {
    saveExportSettings({
      csvDelimiter: "|",
      includeBom: true,
      includeHeaders: false,
      nullDisplay: "NULL",
    });
    expect(getExportSettings()).toStrictEqual({
      csvDelimiter: "|",
      includeBom: true,
      includeHeaders: false,
      nullDisplay: "NULL",
    });
  });
});
