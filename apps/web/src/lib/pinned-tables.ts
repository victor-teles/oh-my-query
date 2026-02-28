const STORAGE_KEY_PREFIX = "oh-my-query-pinned-tables-";

export const getPinnedTables = (connectionId: string): string[] => {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${connectionId}`);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

export const savePinnedTables = (
  connectionId: string,
  tables: string[]
): void => {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${connectionId}`,
    JSON.stringify(tables)
  );
};
