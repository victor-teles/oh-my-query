import { useEffect, useState } from "react";

import { getLauncherHotkey } from "@/lib/ipc";

// null until known; a failed read leaves the in-panel hotkey off rather than
// guessing at the configured chord.
export const useLauncherAccelerator = (): string | null => {
  const [accelerator, setAccelerator] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const value = await getLauncherHotkey();
        if (!cancelled) {
          setAccelerator(value);
        }
      } catch (error) {
        console.error("[launcher] could not read the hotkey", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return accelerator;
};
