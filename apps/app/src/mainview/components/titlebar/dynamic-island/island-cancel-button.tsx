import { X } from "lucide-react";
import { motion } from "motion/react";

import { ISLAND_ITEM_TRANSITION, ISLAND_ITEM_VARIANTS } from "./island-motion";

interface IslandCancelButtonProps {
  onCancel: () => void;
  label?: string;
}

export const IslandCancelButton = ({
  onCancel,
  label = "Cancel query",
}: IslandCancelButtonProps) => (
  <motion.button
    aria-keyshortcuts="Escape"
    aria-label={label}
    className="-mr-1 ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-all duration-150 ease-out hover:bg-destructive/15 hover:text-destructive focus-visible:bg-destructive/15 focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer"
    onClick={onCancel}
    title={`${label} (Esc)`}
    transition={ISLAND_ITEM_TRANSITION}
    type="button"
    variants={ISLAND_ITEM_VARIANTS}
    whileTap={{ scale: 0.85 }}
  >
    <X aria-hidden="true" className="size-2.5" />
  </motion.button>
);
