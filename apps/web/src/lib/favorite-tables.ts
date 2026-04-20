const STORAGE_KEY_PREFIX = "oh-my-query-favorite-tables-";
const LEGACY_KEY_PREFIX = "oh-my-query-pinned-tables-";

const parseList = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};

export const getFavoriteTables = (connectionId: string): string[] => {
  const key = `${STORAGE_KEY_PREFIX}${connectionId}`;
  const existing = parseList(localStorage.getItem(key));
  if (existing.length > 0) {
    return existing;
  }

  const legacyKey = `${LEGACY_KEY_PREFIX}${connectionId}`;
  const legacy = parseList(localStorage.getItem(legacyKey));
  if (legacy.length > 0) {
    localStorage.setItem(key, JSON.stringify(legacy));
    localStorage.removeItem(legacyKey);
    return legacy;
  }

  return [];
};

export const saveFavoriteTables = (
  connectionId: string,
  tables: string[]
): void => {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${connectionId}`,
    JSON.stringify(tables)
  );
};
