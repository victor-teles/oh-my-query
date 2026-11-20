import { useCallback, useEffect, useRef, useState } from "react";

export const CONFIRM_WINDOW_MS = 3000;

// Two-step confirmation: arm() opens a window in which a second press
// confirms; it closes on its own after CONFIRM_WINDOW_MS.
export const useArmedConfirm = () => {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(false);
  }, []);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { arm, armed, disarm };
};
