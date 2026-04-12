const STORAGE_KEY = "om-q:first-connection-seen";

export const isFirstConnectionSeen = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "true";
};

export const markFirstConnectionSeen = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Quota exceeded — non-critical flag, safe to skip
  }
};
