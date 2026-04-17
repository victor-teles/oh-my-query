import type { Extension } from "@codemirror/state";

import { EditorView } from "@codemirror/view";

export interface ThemeEntry {
  key: string;
  label: string;
  isDark: boolean;
}

export const THEME_ENTRIES: ThemeEntry[] = [
  { isDark: true, key: "githubDark", label: "GitHub Dark" },
  { isDark: false, key: "githubLight", label: "GitHub Light" },
  { isDark: true, key: "dracula", label: "Dracula" },
  { isDark: true, key: "atomone", label: "One Dark" },
  { isDark: true, key: "tokyoNight", label: "Tokyo Night" },
  { isDark: false, key: "tokyoNightDay", label: "Tokyo Night Day" },
  { isDark: true, key: "vscodeDark", label: "VS Code Dark" },
  { isDark: true, key: "material", label: "Material" },
  { isDark: true, key: "materialDark", label: "Material Dark" },
  { isDark: false, key: "materialLight", label: "Material Light" },
  { isDark: true, key: "nord", label: "Nord" },
  { isDark: true, key: "solarizedDark", label: "Solarized Dark" },
  { isDark: false, key: "solarizedLight", label: "Solarized Light" },
  { isDark: true, key: "monokai", label: "Monokai" },
  { isDark: true, key: "sublime", label: "Sublime" },
  { isDark: true, key: "aura", label: "Aura" },
  { isDark: true, key: "copilot", label: "Copilot" },
  { isDark: true, key: "andromeda", label: "Andromeda" },
  { isDark: true, key: "xcodeDark", label: "Xcode Dark" },
  { isDark: false, key: "xcodeLight", label: "Xcode Light" },
];

export const PREVIEW_SQL = `SELECT u.name, COUNT(o.id) AS orders
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.active = true
GROUP BY u.name
ORDER BY orders DESC;`;

let themesModule: Record<string, Extension> | null = null;

const loadThemesModule = async (): Promise<Record<string, Extension>> => {
  if (!themesModule) {
    themesModule =
      (await import("@uiw/codemirror-themes-all")) as unknown as Record<
        string,
        Extension
      >;
  }
  return themesModule;
};

export const getThemeExtension = async (key: string): Promise<Extension> => {
  const themes = await loadThemesModule();
  const theme = themes[key];
  if (!theme) {
    return themes.githubDark;
  }
  return theme;
};

export const getDefaultThemeForMode = (isDark: boolean): string =>
  isDark ? "githubDark" : "githubLight";

export const resolveSyntaxTheme = (key: string, isDark: boolean): string => {
  const entry = THEME_ENTRIES.find((t) => t.key === key);
  if (entry && entry.isDark === isDark) {
    return key;
  }
  return getDefaultThemeForMode(isDark);
};

export const createFontExtension = (
  fontFamily: string,
  fontSize: number
): Extension => {
  const family =
    fontFamily === "system-default" ? undefined : `"${fontFamily}", monospace`;
  return EditorView.theme({
    ".cm-content": {
      ...(family && { fontFamily: family }),
      fontSize: `${fontSize}px`,
    },
    ".cm-gutters": {
      ...(family && { fontFamily: family }),
      fontSize: `${fontSize}px`,
    },
  });
};
