import { useCallback, useSyncExternalStore } from "react";

import type { ExportSettings } from "@/lib/export-settings";

import { getExportSettings, saveExportSettings } from "@/lib/export-settings";

const listeners = new Set<() => void>();
// oxlint-disable-next-line jest/require-hook -- module-level cache, not test code
let cachedSettings = getExportSettings();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): ExportSettings => cachedSettings;

const notify = (): void => {
  cachedSettings = getExportSettings();
  for (const listener of listeners) {
    listener();
  }
};

export const useExportSettings = () => {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const updateSettings = useCallback((partial: Partial<ExportSettings>) => {
    const current = getExportSettings();
    const next = { ...current, ...partial };
    saveExportSettings(next);
    notify();
  }, []);

  return { settings, updateSettings };
};
