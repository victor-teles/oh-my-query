import type { ReactNode } from "react";

import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

function CheckMark({ checked }: { checked: boolean }) {
  const { reduced, snappy } = useMotionPreset();
  const transition = reduced ? { duration: 0 } : snappy;
  return (
    <span
      aria-hidden
      className="relative grid size-4 shrink-0 place-items-center rounded-[5px] border border-panel-border"
      data-checked={checked}
    >
      <motion.span
        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.4 }}
        className="absolute -inset-px rounded-[5px] bg-primary"
        initial={false}
        transition={transition}
      />
      <motion.span
        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
        className="relative text-primary-foreground"
        initial={false}
        transition={transition}
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </motion.span>
    </span>
  );
}

interface ImportCheckboxProps {
  checked: boolean;
  unavailable?: boolean;
  autoFocus?: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ImportCheckbox({
  checked,
  unavailable = false,
  autoFocus = false,
  onToggle,
  children,
}: ImportCheckboxProps) {
  return (
    <label className="flex h-10 min-w-0 flex-1 cursor-default items-center gap-3 rounded-[10px] px-2.5 hover:bg-row-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60">
      <input
        aria-disabled={unavailable}
        autoFocus={autoFocus}
        checked={checked}
        className="sr-only"
        data-row-focus
        onChange={onToggle}
        type="checkbox"
      />
      <CheckMark checked={checked} />
      {children}
    </label>
  );
}
