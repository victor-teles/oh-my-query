import { useEffect, useEffectEvent } from "react";

import { matchesAccelerator } from "@/lib/accelerator";

interface UseBoardHotkeysOptions {
  launcherHotkey: string | null;
  editing: boolean;
  onRefresh: () => void;
  onToggleEdit: () => void;
  onLauncher: () => void;
}

// The global shortcut never fires while one of this app's windows is active,
// so a focused board forwards the launcher chord itself.
export const useBoardHotkeys = ({
  launcherHotkey,
  editing,
  onRefresh,
  onToggleEdit,
  onLauncher,
}: UseBoardHotkeysOptions) => {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (launcherHotkey && matchesAccelerator(event, launcherHotkey)) {
      event.preventDefault();
      onLauncher();
      return;
    }
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      onToggleEdit();
      return;
    }
    if (!event.metaKey) {
      return;
    }
    if (event.key === "r") {
      event.preventDefault();
      onRefresh();
    } else if (event.key === "e") {
      event.preventDefault();
      onToggleEdit();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
