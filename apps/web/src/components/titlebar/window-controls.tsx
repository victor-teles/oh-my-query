import { useCallback } from "react";

import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "@/lib/tauri";

export const WindowControls = () => {
  const handleClose = useCallback(async () => {
    await closeWindow();
  }, []);

  const handleMinimize = useCallback(async () => {
    await minimizeWindow();
  }, []);

  const handleMaximize = useCallback(async () => {
    await toggleMaximizeWindow();
  }, []);

  return (
    <div
      className="flex items-center gap-2 pl-3 pr-2"
      role="group"
      aria-label="Window controls"
    >
      <button
        type="button"
        className="group/close flex size-3 items-center justify-center rounded-full bg-[#FF5F57] transition-colors hover:bg-[#FF5F57]/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        onClick={handleClose}
        aria-label="Close window"
      >
        <span className="hidden text-[6px] leading-none text-black/60 group-hover/close:inline">
          &#x2715;
        </span>
      </button>
      <button
        type="button"
        className="group/min flex size-3 items-center justify-center rounded-full bg-[#FEBC2E] transition-colors hover:bg-[#FEBC2E]/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        onClick={handleMinimize}
        aria-label="Minimize window"
      >
        <span className="hidden text-[6px] leading-none text-black/60 group-hover/min:inline">
          &#x2212;
        </span>
      </button>
      <button
        type="button"
        className="group/max flex size-3 items-center justify-center rounded-full bg-[#28C840] transition-colors hover:bg-[#28C840]/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        onClick={handleMaximize}
        aria-label="Maximize window"
      >
        <span className="hidden text-[6px] leading-none text-black/60 group-hover/max:inline">
          &#x2B;
        </span>
      </button>
    </div>
  );
};
