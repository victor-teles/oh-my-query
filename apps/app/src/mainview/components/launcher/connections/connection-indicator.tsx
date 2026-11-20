import { LoaderIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { CheckDraw } from "@/components/motion/check-draw";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { useMotionPreset } from "@/lib/motion";

import type { RowActivity } from "./connections-reducer";

interface ConnectionIndicatorProps {
  activity: RowActivity | undefined;
}

export function ConnectionIndicator({ activity }: ConnectionIndicatorProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  const busy = activity?.kind === "connecting" || activity?.kind === "testing";
  const showSpinner = useDelayedVisibility(busy);
  const showCheck = !showSpinner && activity?.kind === "connected";

  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {showSpinner ? (
          <motion.span
            animate={{ opacity: 1 }}
            className="grid place-items-center"
            exit={{ opacity: 0, transition: fadeOut }}
            initial={{ opacity: 0 }}
            key="spinner"
            transition={fadeIn}
          >
            <LoaderIcon
              aria-label={
                activity?.kind === "testing" ? "Testing" : "Connecting"
              }
              className="size-3.5 animate-spin text-panel-muted"
              role="status"
            />
          </motion.span>
        ) : null}
        {showCheck ? (
          <motion.span
            animate={{ opacity: 1 }}
            className="grid place-items-center"
            exit={{ opacity: 0, transition: fadeOut }}
            initial={{ opacity: 1 }}
            key="check"
          >
            <CheckDraw label="Connected" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
