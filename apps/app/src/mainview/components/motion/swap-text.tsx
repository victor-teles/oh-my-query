import { AnimatePresence, motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

interface SwapTextProps {
  value: string;
  className?: string;
}

export function SwapText({ value, className }: SwapTextProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced
    ? { opacity: 0 }
    : { filter: "blur(4px)", opacity: 0, y: 2 };
  const exit = reduced ? { opacity: 0 } : { opacity: 0, y: -2 };

  return (
    <span className={className} data-slot="swap-text">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          className="inline-block"
          exit={{ ...exit, transition: fadeOut }}
          initial={hidden}
          key={value}
          transition={fadeIn}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
