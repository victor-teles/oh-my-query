type TypeGuard<T> = (value: unknown) => value is T;

export const safeGetJson = <T>(
  key: string,
  fallback: T,
  validate?: TypeGuard<T>
): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
};

export const safeSetJson = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
