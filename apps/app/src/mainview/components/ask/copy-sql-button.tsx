import { CheckIcon, CopyIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

interface CopySqlButtonProps {
  copied: boolean;
  disabled: boolean;
  onCopy: () => void;
}

export function CopySqlButton({
  copied,
  disabled,
  onCopy,
}: CopySqlButtonProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  return (
    <>
      <Pressable
        aria-label="Copy SQL"
        className="grid size-6 place-items-center rounded-[6px] text-panel-muted hover:bg-row-hover hover:text-foreground disabled:opacity-40"
        disabled={disabled}
        onClick={onCopy}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fadeOut }}
            initial={{ opacity: 0 }}
            key={copied ? "copied" : "copy"}
            transition={fadeIn}
          >
            {copied ? (
              <CheckIcon aria-hidden className="size-3.5 text-success-ink" />
            ) : (
              <CopyIcon aria-hidden className="size-3.5" />
            )}
          </motion.span>
        </AnimatePresence>
      </Pressable>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}
