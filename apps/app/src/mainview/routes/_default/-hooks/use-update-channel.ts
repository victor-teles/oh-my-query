import { useCallback, useEffect, useState } from "react";

import type { AvailableUpdate, UpdateChannel } from "@/lib/ipc";

import {
  checkForUpdate as ipcCheckForUpdate,
  getUpdateChannel as ipcGetUpdateChannel,
  installUpdate as ipcInstallUpdate,
  setUpdateChannel as ipcSetUpdateChannel,
} from "@/lib/ipc";

export type { AvailableUpdate, UpdateChannel };

export const UPDATE_CHANNELS: UpdateChannel[] = ["stable", "beta", "nightly"];

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

export const useUpdateChannel = () => {
  const [channel, setChannelState] = useState<UpdateChannel>("stable");
  const [pendingRestart, setPendingRestart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const value = await ipcGetUpdateChannel();
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
      if (next === channel) {
        return;
      }
      const written = await ipcSetUpdateChannel(next);
      if (isUpdateChannel(written)) {
        setChannelState(written);
        setPendingRestart(true);
        setCheck({ status: "idle" });
      }
    },
    [channel]
  );

  const checkNow = useCallback(async () => {
    setCheck({ status: "checking" });
    try {
      const update = await ipcCheckForUpdate();
      if (update) {
        setCheck({ checkedAt: Date.now(), status: "available", update });
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
    setCheck({ status: "installing" });
    try {
      const installed = await ipcInstallUpdate();
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
    supported: true,
  };
};
