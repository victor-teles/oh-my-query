import { useEffect, useEffectEvent } from "react";

import { matchesAccelerator } from "@/lib/accelerator";

interface UseLauncherHotkeysOptions {
  depth: number;
  query: string;
  hotkey: string | null;
  onPop: () => void;
  onClearQuery: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

export const useLauncherHotkeys = ({
  depth,
  query,
  hotkey,
  onPop,
  onClearQuery,
  onDismiss,
  onOpenSettings,
}: UseLauncherHotkeysOptions) => {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (depth > 1) {
        onPop();
      } else if (query.length > 0) {
        onClearQuery();
      } else {
        onDismiss();
      }
      return;
    }
    // The global shortcut never fires while the launcher itself has focus,
    // so the panel closes itself on its own hotkey.
    if (hotkey && matchesAccelerator(event, hotkey)) {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key === "," && event.metaKey) {
      event.preventDefault();
      onOpenSettings();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
