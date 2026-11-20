import { useEffect, useRef, useState } from "react";

export const SHOW_DELAY_MS = 150;
export const MIN_VISIBLE_MS = 300;

// Hides busy states that would flash for under SHOW_DELAY_MS, and keeps a
// shown one up for MIN_VISIBLE_MS so it never blinks.
export const useDelayedVisibility = (active: boolean): boolean => {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (active === visible) {
      return;
    }
    const delay = active
      ? SHOW_DELAY_MS
      : Math.max(0, shownAt.current + MIN_VISIBLE_MS - performance.now());
    const timer = window.setTimeout(() => {
      shownAt.current = performance.now();
      setVisible(active);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, visible]);

  return visible;
};
