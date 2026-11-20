import { useCallback, useEffect, useRef, useState } from "react";

export const FLASH_FOR_MS = 1600;

export const useFlashMessage = <T = string>(durationMs = FLASH_FOR_MS) => {
  const [message, setMessage] = useState<T | null>(null);
  const timer = useRef(0);

  const flash = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current);
      setMessage(next);
      timer.current = window.setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { flash, message };
};
