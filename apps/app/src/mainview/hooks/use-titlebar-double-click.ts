import { useEffect } from "react";

import { toggleWindowMaximize } from "@/lib/ipc";

const DRAG_CLASS = "electrobun-webkit-app-region-drag";
const NO_DRAG_CLASS = "electrobun-webkit-app-region-no-drag";

const isDragRegion = (event: MouseEvent): boolean => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) {
    return false;
  }
  if (
    target.closest(`.${NO_DRAG_CLASS}`) ||
    target.closest('[style*="app-region"][style*="no-drag"]')
  ) {
    return false;
  }
  const draggableByStyle = target.closest(
    '[style*="app-region"][style*="drag"]'
  );
  const draggableByClass = target.closest(`.${DRAG_CLASS}`);
  return Boolean(draggableByStyle || draggableByClass);
};

export const useTitlebarDoubleClick = (): void => {
  useEffect(() => {
    const handler = async (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      if (!isDragRegion(event)) {
        return;
      }
      try {
        await toggleWindowMaximize();
      } catch {
        // best-effort: ignore failures (e.g., window already in transition)
      }
    };
    document.addEventListener("dblclick", handler);
    return () => {
      document.removeEventListener("dblclick", handler);
    };
  }, []);
};
