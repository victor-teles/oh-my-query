import { useCallback, useEffect, useState } from "react";

import type { UpdateChannel } from "@/lib/ipc";

import { getAppVersion, getUpdateChannel, setUpdateChannel } from "@/lib/ipc";

const settle = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch {
    return null;
  }
};

export const useAboutInfo = () => {
  const [version, setVersion] = useState<string | null>(null);
  const [channel, setChannel] = useState<UpdateChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [nextVersion, nextChannel] = await Promise.all([
        settle(getAppVersion()),
        settle(getUpdateChannel()),
      ]);
      if (!cancelled) {
        setVersion(nextVersion);
        setChannel(nextChannel);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeChannel = useCallback(
    async (next: UpdateChannel) => {
      const previous = channel;
      setChannel(next);
      const confirmed = await settle(setUpdateChannel(next));
      setChannel(confirmed ?? previous);
    },
    [channel]
  );

  return { changeChannel, channel, version };
};
