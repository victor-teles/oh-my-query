export type WorkspaceMode = "editor" | "split" | "chat";

const STORAGE_KEY_PREFIX = "oh-my-query-workspace-mode-";
const VALID_MODES: ReadonlySet<WorkspaceMode> = new Set([
  "editor",
  "split",
  "chat",
]);

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "split";

const isWorkspaceMode = (value: unknown): value is WorkspaceMode =>
  typeof value === "string" && VALID_MODES.has(value as WorkspaceMode);

export const getWorkspaceMode = (connectionId: string): WorkspaceMode => {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${connectionId}`);
  if (raw && isWorkspaceMode(raw)) {
    return raw;
  }
  return DEFAULT_WORKSPACE_MODE;
};

export const saveWorkspaceMode = (
  connectionId: string,
  mode: WorkspaceMode
): void => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${connectionId}`, mode);
};
