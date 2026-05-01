import { X } from "lucide-react";
import { motion } from "motion/react";

interface IslandCancelButtonProps {
  onCancel: () => void;
  label?: string;
  keyShortcut?: string | null;
  title?: string;
}

export const IslandCancelButton = ({
  onCancel,
  label = "Cancel query",
  keyShortcut = "Escape",
  title,
}: IslandCancelButtonProps) => (
  <motion.button
    aria-keyshortcuts={keyShortcut ?? undefined}
    aria-label={label}
    className="
      -mr-1 ml-0.5 flex size-4 shrink-0 cursor-pointer items-center
      justify-center rounded-full text-muted-foreground/70 transition-colors
      duration-150 ease-out
      hover:bg-destructive/15 hover:text-destructive
      focus-visible:bg-destructive/15 focus-visible:text-destructive
      focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
    "
    onClick={onCancel}
    title={title ?? (keyShortcut ? `${label} (${keyShortcut})` : label)}
    type="button"
    whileTap={{ scale: 0.85 }}
  >
    <X aria-hidden="true" className="size-2.5" />
  </motion.button>
);
