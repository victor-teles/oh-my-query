import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

import type { SqlAssumptions } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { staggerDelay, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { AssumptionChip, ChipPrefill } from "./assumption-chips";

import { assumptionChips } from "./assumption-chips";

const PULSE = { duration: 0.9, ease: "easeOut" } as const;
const CHIP_CLASS =
  "relative flex h-6 max-w-full items-center overflow-hidden rounded-[6px] border border-panel-border px-2 type-meta tabular-nums";

// A chip whose text changes in place swaps it and pulses amber once.
const usePulse = (label: string): number => {
  const [seen, setSeen] = useState({ label, pulses: 0 });
  if (seen.label !== label) {
    setSeen({ label, pulses: seen.pulses + 1 });
  }
  return seen.pulses;
};

interface ChipProps {
  chip: AssumptionChip;
  interactive: boolean;
  onPrefill: (prefill: ChipPrefill) => void;
}

function Chip({ chip, interactive, onPrefill }: ChipProps) {
  const { reduced } = useMotionPreset();
  const pulses = usePulse(chip.label);
  const content = (
    <>
      {pulses > 0 && !reduced ? (
        <motion.span
          animate={{ opacity: 0 }}
          aria-hidden
          className="absolute inset-0 bg-primary"
          data-testid="chip-pulse"
          initial={{ opacity: 0.14 }}
          key={pulses}
          transition={PULSE}
        />
      ) : null}
      <SwapText className="relative truncate" value={chip.label} />
    </>
  );
  const { prefill } = chip;
  const handleClick = useCallback(() => {
    if (prefill) {
      onPrefill(prefill);
    }
  }, [onPrefill, prefill]);
  if (!(interactive && prefill)) {
    return (
      <span className={cn(CHIP_CLASS, "text-panel-muted")}>{content}</span>
    );
  }
  return (
    <Pressable
      aria-label={chip.actionLabel ?? chip.label}
      className={cn(
        CHIP_CLASS,
        "text-foreground outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/60"
      )}
      onClick={handleClick}
    >
      {content}
    </Pressable>
  );
}

interface AssumptionsLineProps {
  assumptions: SqlAssumptions | null;
  interactive: boolean;
  onPrefill: (prefill: ChipPrefill) => void;
}

export function AssumptionsLine({
  assumptions,
  interactive,
  onPrefill,
}: AssumptionsLineProps) {
  const { reduced, spring, fadeIn, fadeOut } = useMotionPreset();
  const chips = assumptionChips(assumptions);
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: 2 };
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 ? (
        <motion.ul
          animate={{ opacity: 1 }}
          aria-label="Assumptions"
          className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-2"
          exit={{ opacity: 0, transition: fadeOut }}
          initial={{ opacity: 0 }}
          key="assumptions"
          transition={fadeIn}
        >
          <AnimatePresence mode="popLayout">
            {chips.map((chip, index) => (
              <motion.li
                animate={{ opacity: 1, y: 0 }}
                className="max-w-full"
                exit={{ opacity: 0, transition: fadeOut }}
                initial={hidden}
                key={chip.key}
                layout={reduced ? false : "position"}
                transition={{
                  ...fadeIn,
                  delay: reduced ? 0 : staggerDelay(index),
                  layout: spring,
                }}
              >
                <Chip
                  chip={chip}
                  interactive={interactive}
                  onPrefill={onPrefill}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : null}
    </AnimatePresence>
  );
}
