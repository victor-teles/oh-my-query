import { useHotkey } from "@tanstack/react-hotkeys";

import type { WorkspaceMode } from "@/lib/workspace-mode";

interface WorkspaceModeHotkeysParams {
  setMode: (next: WorkspaceMode) => void;
}

export const useWorkspaceModeHotkeys = ({
  setMode,
}: WorkspaceModeHotkeysParams) => {
  useHotkey("Mod+Shift+1", () => {
    setMode("editor");
  });

  useHotkey("Mod+Shift+2", () => {
    setMode("split");
  });

  useHotkey("Mod+Shift+3", () => {
    setMode("chat");
  });
};
