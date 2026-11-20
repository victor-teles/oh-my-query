import { useEffect, useRef } from "react";

import { resizeLauncher } from "@/lib/ipc";

interface UseWindowHeightSyncOptions {
  margin: number;
  reduced: boolean;
}

// Covers changes that settle without a layout animation (e.g. instant swaps).
const SHRINK_FALLBACK_MS = 450;

const requestResize = async (height: number) => {
  try {
    await resizeLauncher(height);
  } catch (error) {
    console.error("[launcher] resizeLauncher failed", error);
  }
};

// Grows the native window before content animates in, and shrinks it only
// after the layout animation settles, so the panel never clips.
export const useWindowHeightSync = ({
  margin,
  reduced,
}: UseWindowHeightSyncOptions) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const windowHeight = useRef(0);
  const pendingShrink = useRef<number | null>(null);
  const fallback = useRef(0);

  const apply = (height: number) => {
    window.clearTimeout(fallback.current);
    windowHeight.current = height;
    pendingShrink.current = null;
    requestResize(height);
  };

  const settle = () => {
    if (pendingShrink.current !== null) {
      apply(pendingShrink.current);
    }
  };

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = Math.ceil(panel.offsetHeight + margin * 2);
      if (next > windowHeight.current || reduced) {
        if (next !== windowHeight.current) {
          apply(next);
        }
        return;
      }
      if (next < windowHeight.current) {
        pendingShrink.current = next;
        window.clearTimeout(fallback.current);
        fallback.current = window.setTimeout(settle, SHRINK_FALLBACK_MS);
      }
    };
    const observer = new ResizeObserver(() => {
      if (!frame) {
        frame = requestAnimationFrame(measure);
      }
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback.current);
    };
  }, [margin, reduced]);

  return { panelRef, settle };
};
