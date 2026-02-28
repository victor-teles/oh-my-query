export interface EditorSettings {
  syntaxTheme: string;
  fontFamily: string;
  fontSize: number;
}

const STORAGE_KEY = "oh-my-query-editor-settings";

const DEFAULT_SETTINGS: EditorSettings = {
  fontFamily: "system-default",
  fontSize: 14,
  syntaxTheme: "githubDark",
};

export const FONT_FAMILIES = [
  { label: "System Default", value: "system-default" },
  { label: "JetBrains Mono", value: "JetBrains Mono" },
  { label: "Fira Code", value: "Fira Code" },
  { label: "SF Mono", value: "SF Mono" },
  { label: "Menlo", value: "Menlo" },
  { label: "Consolas", value: "Consolas" },
  { label: "Source Code Pro", value: "Source Code Pro" },
] as const;

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;

export const getEditorSettings = (): EditorSettings => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<EditorSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveEditorSettings = (settings: EditorSettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
