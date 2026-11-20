import { useCallback, useEffect, useState } from "react";

import { getErrorMessage } from "@/lib/error-message";
import { getClipboardLookups, setClipboardLookups } from "@/lib/ipc";

export type ClipboardLookupSetting =
  | { status: "loading" }
  | { status: "ready"; enabled: boolean; saving: boolean; error: string | null }
  | { status: "error"; message: string };

const readSetting = async (): Promise<ClipboardLookupSetting> => {
  try {
    return {
      enabled: await getClipboardLookups(),
      error: null,
      saving: false,
      status: "ready",
    };
  } catch (error) {
    return {
      message: getErrorMessage(error, "Settings could not be read."),
      status: "error",
    };
  }
};

export const useClipboardLookupSetting = () => {
  const [attempt, setAttempt] = useState(0);
  const [setting, setSetting] = useState<ClipboardLookupSetting>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await readSetting();
      if (!cancelled) {
        setSetting(next);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setSetting({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const change = useCallback(async (enabled: boolean) => {
    setSetting({ enabled, error: null, saving: true, status: "ready" });
    try {
      const saved = await setClipboardLookups(enabled);
      setSetting({
        enabled: saved,
        error: null,
        saving: false,
        status: "ready",
      });
    } catch (error) {
      setSetting({
        enabled: !enabled,
        error: getErrorMessage(error, "The setting could not be saved."),
        saving: false,
        status: "ready",
      });
    }
  }, []);

  return { change, retry, setting };
};
