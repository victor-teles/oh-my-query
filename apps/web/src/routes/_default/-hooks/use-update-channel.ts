import { useCallback, useEffect, useState } from "react";

import { isTauri } from "@/lib/tauri";

export type UpdateChannel = "stable" | "beta" | "nightly";

export const UPDATE_CHANNELS: UpdateChannel[] = ["stable", "beta", "nightly"];

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "no-update"; checkedAt: number }
  | { status: "available"; update: AvailableUpdate; checkedAt: number }
  | { status: "installing" }
  | { status: "installed" }
  | { status: "error"; message: string };

const isUpdateChannel = (value: string): value is UpdateChannel =>
  (UPDATE_CHANNELS as string[]).includes(value);

const getInvoke = async () => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke;
};

export const useUpdateChannel = () => {
  const [channel, setChannelState] = useState<UpdateChannel>("stable");
  const [pendingRestart, setPendingRestart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  useEffect(() => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const invoke = await getInvoke();
        const value = await invoke<string>("get_update_channel");
        if (!cancelled && isUpdateChannel(value)) {
          setChannelState(value);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setChannel = useCallback(
    async (next: UpdateChannel) => {
      if (!isTauri() || next === channel) {
        return;
      }
      const invoke = await getInvoke();
      const written = await invoke<string>("set_update_channel", {
        channel: next,
      });
      if (isUpdateChannel(written)) {
        setChannelState(written);
        setPendingRestart(true);
        setCheck({ status: "idle" });
      }
    },
    [channel]
  );

  const checkNow = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    setCheck({ status: "checking" });
    try {
      const invoke = await getInvoke();
      const update = await invoke<AvailableUpdate | null>("check_for_update");
      if (update) {
        setCheck({
          checkedAt: Date.now(),
          status: "available",
          update,
        });
      } else {
        setCheck({ checkedAt: Date.now(), status: "no-update" });
      }
    } catch (error) {
      setCheck({
        message: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    }
  }, []);

  const installNow = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    setCheck({ status: "installing" });
    try {
      const invoke = await getInvoke();
      const installed = await invoke<boolean>("install_update");
      setCheck(
        installed
          ? { status: "installed" }
          : { checkedAt: Date.now(), status: "no-update" }
      );
    } catch (error) {
      setCheck({
        message: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    }
  }, []);

  return {
    channel,
    channels: UPDATE_CHANNELS,
    check,
    checkNow,
    installNow,
    loading,
    pendingRestart,
    setChannel,
    supported: isTauri(),
  };
};
