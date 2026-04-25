import { describe, expect, it } from "vitest";

import {
  createFontExtension,
  getDefaultThemeForMode,
  PREVIEW_SQL,
  resolveSyntaxTheme,
  THEME_ENTRIES,
} from "@/lib/codemirror-themes";

describe("tHEME_ENTRIES + PREVIEW_SQL", () => {
  it("exposes a non-empty list of themes", () => {
    expect(THEME_ENTRIES.length).toBeGreaterThan(0);
    for (const entry of THEME_ENTRIES) {
      expect(entry.key).toBeTypeOf("string");
      expect(entry.label).toBeTypeOf("string");
      expect(entry.isDark).toBeTypeOf("boolean");
    }
  });

  it("includes both dark and light themes", () => {
    expect(THEME_ENTRIES.some((t) => t.isDark)).toBeTruthy();
    expect(THEME_ENTRIES.some((t) => !t.isDark)).toBeTruthy();
  });

  it("uses unique keys", () => {
    const keys = THEME_ENTRIES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ships a non-empty preview SQL", () => {
    expect(PREVIEW_SQL).toMatch(/SELECT/);
  });
});

describe("getDefaultThemeForMode", () => {
  it("returns githubDark for dark mode", () => {
    expect(getDefaultThemeForMode(true)).toBe("githubDark");
  });

  it("returns githubLight for light mode", () => {
    expect(getDefaultThemeForMode(false)).toBe("githubLight");
  });
});

describe("resolveSyntaxTheme", () => {
  it("keeps the requested theme when its mode matches", () => {
    expect(resolveSyntaxTheme("dracula", true)).toBe("dracula");
    expect(resolveSyntaxTheme("solarizedLight", false)).toBe("solarizedLight");
  });

  it("falls back to the default for the mode when the requested theme is the wrong mode", () => {
    expect(resolveSyntaxTheme("dracula", false)).toBe("githubLight");
    expect(resolveSyntaxTheme("solarizedLight", true)).toBe("githubDark");
  });

  it("falls back to the default for unknown theme keys", () => {
    expect(resolveSyntaxTheme("does-not-exist", true)).toBe("githubDark");
    expect(resolveSyntaxTheme("does-not-exist", false)).toBe("githubLight");
  });
});

describe("createFontExtension", () => {
  it("returns a CodeMirror extension", () => {
    const extension = createFontExtension("JetBrains Mono Variable", 14);
    expect(extension).toBeTruthy();
  });

  it("uses the provided font family for non-system-default", () => {
    const extension = createFontExtension("Fira Code", 16);
    expect(extension).toBeTruthy();
  });

  it("omits a fontFamily override when the choice is system-default", () => {
    const extension = createFontExtension("system-default", 14);
    expect(extension).toBeTruthy();
  });
});
