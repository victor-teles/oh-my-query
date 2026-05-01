import { useEffect, useState } from "react";

const TICK_MS = 250;

export const useElapsedSince = (startedAt: number | null): number => {
  const [now, setNow] = useState(() =>
    startedAt ? Math.max(0, Date.now() - startedAt) : 0
  );

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    setNow(Math.max(0, Date.now() - startedAt));
    const id = setInterval(() => {
      setNow(Math.max(0, Date.now() - startedAt));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);

  return now;
};

export const formatElapsed = (ms: number): string => {
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
