import type { ReactNode } from "react";

import { motion } from "motion/react";

import { staggerDelay, useMotionPreset } from "@/lib/motion";

interface ArgumentPillProps {
  label: string;
  index: number;
  active: boolean;
  popover?: ReactNode;
  children: ReactNode;
}

export function ArgumentPill({
  label,
  index,
  active,
  popover,
  children,
}: ArgumentPillProps) {
  const { reduced, spring, snappy } = useMotionPreset();
  return (
    <motion.span
      animate={{ opacity: 1, x: 0 }}
      className="relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-row-hover px-2"
      data-active={active}
      initial={reduced ? false : { opacity: 0, x: -8 }}
      layout="position"
      transition={{ ...spring, delay: staggerDelay(index) }}
    >
      {active ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[8px] bg-primary/12 ring-1 ring-primary/55"
          layoutId="arg-focus"
          transition={snappy}
        />
      ) : null}
      <span aria-hidden className="relative type-micro text-panel-muted">
        {label}
      </span>
      <span className="relative flex min-w-0 items-center">{children}</span>
      {popover}
    </motion.span>
  );
}
