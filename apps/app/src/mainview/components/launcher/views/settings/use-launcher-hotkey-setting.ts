import { useCallback, useEffect, useState } from "react";

import { getErrorMessage } from "@/lib/error-message";
import { getLauncherHotkey } from "@/lib/ipc";

export type HotkeySetting =
  | { status: "loading" }
  | { status: "ready"; accelerator: string }
  | { status: "error"; message: string };

const readHotkeySetting = async (): Promise<HotkeySetting> => {
  try {
    return { accelerator: await getLauncherHotkey(), status: "ready" };
  } catch (error) {
    return {
      message: getErrorMessage(error, "Settings could not be read."),
      status: "error",
    };
  }
};

export const useLauncherHotkeySetting = () => {
  const [attempt, setAttempt] = useState(0);
  const [setting, setSetting] = useState<HotkeySetting>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await readHotkeySetting();
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

  return { retry, setting };
};
