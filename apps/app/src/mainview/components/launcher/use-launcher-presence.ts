import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { LauncherShown } from "@/lib/ipc";

import {
  hideLauncher,
  onLauncherDismiss,
  onLauncherShown,
  onLauncherToggle,
} from "@/lib/ipc";

export type Presence = "shown" | "hidden";

interface UseLauncherPresenceOptions {
  onShown: (hiddenForMs: number, shown: LauncherShown) => void;
  onHidden: () => void;
}

const SHOWN_LOCALLY: LauncherShown = { clipboard: null };

const requestHide = async () => {
  try {
    await hideLauncher();
  } catch (error) {
    console.error("[launcher] hideLauncher failed", error);
  }
};

export const useLauncherPresence = ({
  onShown,
  onHidden,
}: UseLauncherPresenceOptions) => {
  const [presence, setPresence] = useState<Presence>("shown");
  const hiddenAt = useRef<number | null>(null);

  const reveal = useEffectEvent((shown: LauncherShown) => {
    setPresence("shown");
    const hiddenFor =
      hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
    hiddenAt.current = null;
    onShown(hiddenFor, shown);
  });

  const toggle = useEffectEvent(() => {
    if (presence === "shown") {
      setPresence("hidden");
      return;
    }
    reveal(SHOWN_LOCALLY);
  });

  useEffect(() => {
    const unsubscribers = [
      onLauncherShown(reveal),
      onLauncherToggle(toggle),
      onLauncherDismiss(() => setPresence("hidden")),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, []);

  const onPresenceSettled = (settled: unknown) => {
    if (settled !== "hidden" || presence !== "hidden") {
      return;
    }
    hiddenAt.current = Date.now();
    onHidden();
    requestHide();
  };

  const dismiss = useCallback(() => setPresence("hidden"), []);

  return {
    dismiss,
    onPresenceSettled,
    presence,
  };
};
