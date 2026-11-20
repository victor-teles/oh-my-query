import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

// The one looping indicator: a 2px sweep along the top edge of stale
// content. Mount it inside AnimatePresence so it fades in and out.
export function ProgressHairline() {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-hidden
      className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden"
      data-testid="run-progress"
      exit={{ opacity: 0, transition: fadeOut }}
      initial={{ opacity: 0 }}
      transition={fadeIn}
    >
      {reduced ? (
        <div className="h-full w-full bg-primary/40" />
      ) : (
        <motion.div
          animate={{ x: ["-100%", "250%"] }}
          className="h-full w-2/5 bg-primary"
          transition={{
            duration: 1.1,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      )}
    </motion.div>
  );
}
