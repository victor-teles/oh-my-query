import { useCallback, useEffect, useRef, useState } from "react";

export const FLASH_FOR_MS = 1600;

export const useFlashMessage = () => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef(0);

  const flash = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(null), FLASH_FOR_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { flash, message };
};
