import type { ReactNode } from "react";

import { motion } from "motion/react";
import { useCallback } from "react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const optionId = (id: string) => `launcher-option-${id}`;

export type RowTone = "default" | "destructive";

interface LauncherRowProps {
  id: string;
  selected: boolean;
  tone?: RowTone;
  describedBy?: string;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
  children: ReactNode;
}

export function LauncherRow({
  id,
  selected,
  tone = "default",
  describedBy,
  onHover,
  onRun,
  children,
}: LauncherRowProps) {
  const { spring, snappy, fadeIn, fadeOut, pressed, press } = useMotionPreset();
  const handleClick = useCallback(() => onRun(id), [onRun, id]);
  const handlePointerMove = useCallback(() => onHover(id), [onHover, id]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-describedby={describedBy}
      aria-selected={selected}
      className="relative flex h-10 cursor-default items-center gap-3 px-2.5"
      data-tone={tone}
      exit={{ opacity: 0, transition: fadeOut }}
      id={optionId(id)}
      initial={{ opacity: 0 }}
      layout="position"
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      role="option"
      transition={{ layout: spring, opacity: fadeIn }}
      whileTap={{ ...pressed, transition: press }}
    >
      {selected ? (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-[10px]",
            tone === "destructive" ? "bg-destructive/14" : "bg-row-active"
          )}
          layoutId="launcher-selection"
          transition={snappy}
        />
      ) : null}
      {children}
    </motion.div>
  );
}
