import { motion } from "motion/react";

import { CheckDraw } from "@/components/motion/check-draw";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { DRAW, useMotionPreset } from "@/lib/motion";

import type { ExportOutcome } from "./use-export";

interface ExportStatusProps {
  outcome: ExportOutcome;
  onReveal: () => void;
}

export function ExportStatus({ outcome, onReveal }: ExportStatusProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const exported = outcome.kind === "exported";
  return (
    <motion.span
      animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      className="flex min-w-0 items-center gap-1.5"
      exit={{ opacity: 0, transition: fadeOut }}
      initial={reduced ? false : { filter: "blur(4px)", opacity: 0, y: 2 }}
      role="status"
      transition={fadeIn}
    >
      {exported ? <CheckDraw label="Exported" /> : null}
      <SwapText
        className={
          exported ? "truncate text-foreground" : "truncate text-danger-ink"
        }
        value={outcome.text}
      />
      {exported && outcome.savedId ? (
        <Reveal className="shrink-0" delay={reduced ? 0 : DRAW.duration}>
          <Pressable
            className="rounded-[6px] px-1.5 py-0.5 type-meta text-panel-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            onClick={onReveal}
          >
            Show in Finder
          </Pressable>
        </Reveal>
      ) : null}
    </motion.span>
  );
}
