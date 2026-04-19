const STORAGE_KEY_PREFIX = "oh-my-query-recent-tables-";
const MAX_RECENT = 5;

export const getRecentTables = (connectionId: string): string[] => {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${connectionId}`);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as string[]).slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentTables = (
  connectionId: string,
  tables: string[]
): void => {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${connectionId}`,
    JSON.stringify(tables.slice(0, MAX_RECENT))
  );
};

export const RECENT_TABLES_LIMIT = MAX_RECENT;
