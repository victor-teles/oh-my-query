import type { MouseEvent, ReactNode, Ref } from "react";

import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

export const PILL_POPOVER_SPACE = 300;

// Clicking an option must not blur the pill it belongs to; date fields may.
const keepFocusUnlessField = (event: MouseEvent<HTMLDivElement>) => {
  if (!(event.target instanceof HTMLInputElement)) {
    event.preventDefault();
  }
};

interface PillPopoverProps {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function PillPopover({ ref, children }: PillPopoverProps) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-full left-0 z-30 mt-2 flex w-60 flex-col rounded-[12px] popover-material p-1"
      onMouseDown={keepFocusUnlessField}
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      ref={ref}
      style={{ originX: 0, originY: 0 }}
      transition={{ ...snappy, opacity: fadeIn }}
    >
      {children}
    </motion.div>
  );
}
