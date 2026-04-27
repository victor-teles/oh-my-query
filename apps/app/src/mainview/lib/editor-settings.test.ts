import { describe, expect, it } from "vitest";

import {
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  getEditorSettings,
  saveEditorSettings,
} from "@/lib/editor-settings";

const STORAGE_KEY = "oh-my-query-editor-settings";

describe("editor settings", () => {
  it("exposes a non-empty list of font families", () => {
    expect(FONT_FAMILIES.length).toBeGreaterThan(0);
    expect(FONT_FAMILIES[0]).toStrictEqual({
      label: "JetBrains Mono",
      value: "JetBrains Mono Variable",
    });
  });

  it("clamps font size between MIN and MAX bounds", () => {
    expect(FONT_SIZE_MIN).toBeLessThan(FONT_SIZE_MAX);
  });

  it("returns defaults when no settings are stored", () => {
    expect(getEditorSettings()).toStrictEqual({
      fontFamily: "JetBrains Mono Variable",
      fontSize: 14,
      syntaxTheme: "githubDark",
    });
  });

  it("merges stored partial settings with defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize: 18 }));
    expect(getEditorSettings()).toStrictEqual({
      fontFamily: "JetBrains Mono Variable",
      fontSize: 18,
      syntaxTheme: "githubDark",
    });
  });

  it("falls back to defaults when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(getEditorSettings()).toStrictEqual({
      fontFamily: "JetBrains Mono Variable",
      fontSize: 14,
      syntaxTheme: "githubDark",
    });
  });

  it("round-trips via save → get", () => {
    saveEditorSettings({
      fontFamily: "Fira Code",
      fontSize: 16,
      syntaxTheme: "dracula",
    });
    expect(getEditorSettings()).toStrictEqual({
      fontFamily: "Fira Code",
      fontSize: 16,
      syntaxTheme: "dracula",
    });
  });
});
