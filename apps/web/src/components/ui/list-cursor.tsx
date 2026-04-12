import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const CURSOR_SPRING = {
  damping: 30,
  stiffness: 400,
  type: "spring",
} as const;

interface ListCursorProps {
  layoutId: string;
  className?: string;
}

export const ListCursor = ({ layoutId, className }: ListCursorProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      layoutId={shouldReduceMotion ? undefined : layoutId}
      transition={CURSOR_SPRING}
      className={cn("absolute rounded-full bg-primary", className)}
    />
  );
};
