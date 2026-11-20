import { AnimatePresence, motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

import type { InputMode } from "./input-mode";

const LABELS: Record<Exclude<InputMode, "search">, string> = {
  connection: "Connection",
  sql: "SQL",
  table: "Table",
};

const ANNOUNCEMENTS: Record<InputMode, string> = {
  connection: "Connection mode",
  search: "",
  sql: "SQL mode",
  table: "Table mode",
};

interface ModeBadgeProps {
  mode: InputMode;
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 };
  const leaving = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
        {mode === "search" ? null : (
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            aria-hidden
            className="flex h-6 shrink-0 items-center rounded-[6px] bg-primary/14 px-2 type-micro font-semibold text-primary"
            exit={{ ...leaving, transition: fadeOut }}
            initial={hidden}
            key={mode}
            layout
            transition={{ ...snappy, opacity: fadeIn }}
          >
            {LABELS[mode]}
          </motion.span>
        )}
      </AnimatePresence>
      <span aria-live="polite" className="sr-only">
        {ANNOUNCEMENTS[mode]}
      </span>
    </>
  );
}
