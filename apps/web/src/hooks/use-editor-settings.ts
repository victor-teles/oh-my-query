import { useCallback, useSyncExternalStore } from "react";

import type { EditorSettings } from "@/lib/editor-settings";

import { getEditorSettings, saveEditorSettings } from "@/lib/editor-settings";

const listeners = new Set<() => void>();
// oxlint-disable-next-line jest/require-hook -- module-level cache, not test code
let cachedSettings = getEditorSettings();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): EditorSettings => cachedSettings;

const notify = (): void => {
  cachedSettings = getEditorSettings();
  for (const listener of listeners) {
    listener();
  }
};

export const useEditorSettings = () => {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const updateSettings = useCallback((partial: Partial<EditorSettings>) => {
    const current = getEditorSettings();
    const next = { ...current, ...partial };
    saveEditorSettings(next);
    notify();
  }, []);

  return { settings, updateSettings };
};
