import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { CheckDraw } from "@/components/motion/check-draw";
import { useMotionPreset } from "@/lib/motion";

export type AskIndicatorState = "busy" | "success" | "error" | "idle";

function BusyMark() {
  const { reduced } = useMotionPreset();
  if (reduced) {
    return (
      <span
        aria-label="Working"
        className="block size-1.5 rounded-full bg-panel-muted"
        role="img"
      />
    );
  }
  return (
    <LoaderCircleIcon
      aria-label="Working"
      className="size-3.5 animate-spin text-panel-muted"
      role="img"
    />
  );
}

const MARKS: Record<
  Exclude<AskIndicatorState, "idle">,
  () => React.ReactNode
> = {
  busy: () => <BusyMark />,
  error: () => (
    <CircleAlertIcon
      aria-label="Failed"
      className="size-3.5 text-danger-ink"
      role="img"
    />
  ),
  success: () => <CheckDraw label="Done" />,
};

interface AskIndicatorProps {
  state: AskIndicatorState;
}

export function AskIndicator({ state }: AskIndicatorProps) {
  const { snappy, fadeOut } = useMotionPreset();
  return (
    <span className="grid size-5 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {state === "idle" ? null : (
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            className="grid place-items-center"
            exit={{ opacity: 0, scale: 0.8, transition: fadeOut }}
            initial={{ opacity: 0, scale: 0.8 }}
            key={state}
            transition={snappy}
          >
            {MARKS[state]()}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
