import { AnimatePresence, motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

interface LookupProgressProps {
  done: number;
  total: number;
  running: boolean;
}

const INSTANT = { duration: 0 };

export function LookupProgress({ done, total, running }: LookupProgressProps) {
  const { reduced, soft, fadeOut } = useMotionPreset();
  const fraction = total > 0 ? done / total : 0;
  return (
    <AnimatePresence initial={false}>
      {running ? (
        <motion.div
          animate={{ scaleX: fraction }}
          aria-label="Search progress"
          aria-valuemax={total}
          aria-valuemin={0}
          aria-valuenow={done}
          className="absolute inset-x-0 top-0 h-0.5 bg-primary"
          data-motion={reduced ? "instant" : "spring"}
          exit={{ opacity: 0, transition: reduced ? INSTANT : fadeOut }}
          initial={{ scaleX: 0 }}
          key="progress"
          role="progressbar"
          style={{ originX: 0 }}
          transition={reduced ? INSTANT : soft}
        />
      ) : null}
    </AnimatePresence>
  );
}
