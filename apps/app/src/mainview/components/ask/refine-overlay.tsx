import { motion } from "motion/react";

import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";

import { turnLayoutId } from "./question-trail";

export interface RefineGhost {
  text: string;
  index: number;
}

interface RefineOverlayProps {
  draft: string;
  placeholder: string;
  ghost: RefineGhost | null;
}

// Draws the placeholder (so it can swap) and an invisible copy of the typed
// follow-up that the trail's new crumb grows out of when ↵ lifts it.
export function RefineOverlay({
  draft,
  placeholder,
  ghost,
}: RefineOverlayProps) {
  const { reduced, spring } = useMotionPreset();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center overflow-hidden type-input"
    >
      {draft === "" ? (
        <SwapText
          className="truncate text-panel-muted opacity-80"
          value={placeholder}
        />
      ) : null}
      {ghost && !reduced ? (
        <motion.span
          className="absolute left-0 whitespace-pre opacity-0"
          data-testid="refine-ghost"
          layoutId={turnLayoutId(ghost.index)}
          transition={spring}
        >
          {ghost.text}
        </motion.span>
      ) : null}
    </div>
  );
}
