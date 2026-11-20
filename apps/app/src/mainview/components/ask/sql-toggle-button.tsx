import { ChevronDownIcon } from "lucide-react";
import { motion } from "motion/react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

interface SqlToggleButtonProps {
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function SqlToggleButton({
  expanded,
  disabled,
  onToggle,
}: SqlToggleButtonProps) {
  const { reduced, snappy } = useMotionPreset();
  return (
    <Pressable
      aria-expanded={expanded}
      aria-label={expanded ? "Hide SQL" : "Show SQL"}
      className="grid size-6 place-items-center rounded-[6px] text-panel-muted hover:bg-row-hover hover:text-foreground disabled:opacity-40"
      disabled={disabled}
      onClick={onToggle}
    >
      <motion.span
        animate={{ rotate: expanded ? 180 : 0 }}
        className="grid place-items-center"
        initial={false}
        transition={reduced ? { duration: 0 } : snappy}
      >
        <ChevronDownIcon aria-hidden className="size-3.5" />
      </motion.span>
    </Pressable>
  );
}
