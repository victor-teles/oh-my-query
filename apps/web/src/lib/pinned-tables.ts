import { safeGetJson, safeSetJson } from "@/lib/safe-storage";

const STORAGE_KEY_PREFIX = "oh-my-query-pinned-tables-";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

export const getPinnedTables = (connectionId: string): string[] =>
  safeGetJson<string[]>(
    `${STORAGE_KEY_PREFIX}${connectionId}`,
    [],
    isStringArray
  );

export const savePinnedTables = (
  connectionId: string,
  tables: string[]
): void => {
  safeSetJson(`${STORAGE_KEY_PREFIX}${connectionId}`, tables);
};
