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
  window.localStorage.setItem(STORAGE_KEY, "true");
};
