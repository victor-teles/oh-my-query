import type { ReactNode } from "react";

import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

interface LauncherInputRowProps {
  busy?: boolean;
  chip?: ReactNode;
  onSubmit: () => void;
  onStop?: () => void;
  children: ReactNode;
}

export function LauncherInputRow({
  busy = false,
  chip,
  onSubmit,
  onStop,
  children,
}: LauncherInputRowProps) {
  const { spring, snappy, fadeIn } = useMotionPreset();

  return (
    <div className="relative z-20 flex h-14 shrink-0 items-center gap-2.5 px-4">
      {chip}
      <motion.div
        className="flex min-w-0 flex-1 items-center"
        layout="position"
        transition={spring}
      >
        {children}
      </motion.div>
      <Pressable
        aria-label={busy ? "Stop" : "Run"}
        className="grid size-7 shrink-0 place-items-center bg-row-hover text-panel-muted hover:text-foreground"
        layout
        onClick={busy ? onStop : onSubmit}
        style={{ borderRadius: busy ? 6 : 8 }}
        transition={snappy}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            className="grid place-items-center"
            exit={{ opacity: 0, scale: 0.6 }}
            initial={{ opacity: 0, scale: 0.6 }}
            key={busy ? "stop" : "run"}
            transition={fadeIn}
          >
            {busy ? (
              <SquareIcon aria-hidden className="size-3 fill-current" />
            ) : (
              <CornerDownLeftIcon aria-hidden className="size-3.5" />
            )}
          </motion.span>
        </AnimatePresence>
      </Pressable>
    </div>
  );
}
