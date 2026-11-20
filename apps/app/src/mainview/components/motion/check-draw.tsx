import { motion } from "motion/react";

import { DRAW, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface CheckDrawProps {
  label: string;
  className?: string;
}

export function CheckDraw({ label, className }: CheckDrawProps) {
  const { reduced } = useMotionPreset();
  return (
    <svg
      aria-label={label}
      className={cn("size-3.5 text-success-ink", className)}
      fill="none"
      role="img"
      viewBox="0 0 16 16"
    >
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={{ pathLength: reduced ? 1 : 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        transition={reduced ? { duration: 0 } : DRAW}
      />
    </svg>
  );
}
