import type { Transition, Variants } from "motion/react";

export const ISLAND_ITEM_VARIANTS: Variants = {
  hidden: { filter: "blur(4px)", opacity: 0 },
  visible: { filter: "blur(0px)", opacity: 1 },
};

export const ISLAND_ITEM_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};
