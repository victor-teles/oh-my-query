import { useCallback, useEffect, useState } from "react";

import type { WorkspaceMode } from "@/lib/workspace-mode";

import {
  DEFAULT_WORKSPACE_MODE,
  getWorkspaceMode,
  saveWorkspaceMode,
} from "@/lib/workspace-mode";

interface UseWorkspaceModeReturn {
  mode: WorkspaceMode;
  setMode: (next: WorkspaceMode) => void;
}

export const useWorkspaceMode = (
  connectionId: string
): UseWorkspaceModeReturn => {
  const [mode, setModeState] = useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);

  useEffect(() => {
    setModeState(getWorkspaceMode(connectionId));
  }, [connectionId]);

  const setMode = useCallback(
    (next: WorkspaceMode) => {
      setModeState(next);
      saveWorkspaceMode(connectionId, next);
    },
    [connectionId]
  );

  return { mode, setMode };
};
