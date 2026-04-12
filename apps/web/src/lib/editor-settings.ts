import { safeGetJson, safeSetJson } from "@/lib/safe-storage";

export interface EditorSettings {
  syntaxTheme: string;
  fontFamily: string;
  fontSize: number;
}

const STORAGE_KEY = "oh-my-query-editor-settings";

const DEFAULT_SETTINGS: EditorSettings = {
  fontFamily: "JetBrains Mono Variable",
  fontSize: 14,
  syntaxTheme: "githubDark",
};

export const FONT_FAMILIES = [
  { label: "JetBrains Mono", value: "JetBrains Mono Variable" },
  { label: "System Default", value: "system-default" },
  { label: "Fira Code", value: "Fira Code" },
  { label: "SF Mono", value: "SF Mono" },
  { label: "Menlo", value: "Menlo" },
  { label: "Consolas", value: "Consolas" },
  { label: "Source Code Pro", value: "Source Code Pro" },
] as const;

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;

export const getEditorSettings = (): EditorSettings => ({
  ...DEFAULT_SETTINGS,
  ...safeGetJson<Partial<EditorSettings>>(STORAGE_KEY, {}),
});

export const saveEditorSettings = (settings: EditorSettings): void => {
  safeSetJson(STORAGE_KEY, settings);
};
