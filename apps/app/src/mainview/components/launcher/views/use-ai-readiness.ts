import { isAiConfigured } from "@oh-my-query/rpc";
import { useEffect, useState } from "react";

import { getAiSettings } from "@/lib/ipc";

// null until the settings are known; a failed read stays unknown so the
// launcher never nags about setup it could not verify.
export const useAiReadiness = (): boolean | null => {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await getAiSettings();
        if (!cancelled) {
          setReady(isAiConfigured(settings));
        }
      } catch {
        if (!cancelled) {
          setReady(null);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
};
