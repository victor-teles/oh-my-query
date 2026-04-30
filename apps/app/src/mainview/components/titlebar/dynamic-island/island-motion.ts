import type { Transition, Variants } from "motion/react";

export const ISLAND_ITEM_VARIANTS: Variants = {
  hidden: { filter: "blur(4px)", opacity: 0 },
  visible: { filter: "blur(0px)", opacity: 1 },
};

export const ISLAND_ITEM_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

// Connectivity dots — staggered opacity pulse (grey, 1.2s cycle)
export const CONNECT_DOT_TRANSITION = (i: number): Transition => ({
  delay: i * 0.2,
  duration: 1.2,
  ease: "easeInOut",
  repeat: Infinity,
});

// Reconnect dots — faster pulse (amber, 1.0s cycle)
export const RECONNECT_DOT_TRANSITION = (i: number): Transition => ({
  delay: i * 0.15,
  duration: 1,
  ease: "easeInOut",
  repeat: Infinity,
});

// Streaming waveform bars — audio-meter style scaleY oscillation
export const STREAM_BAR_HEIGHTS = [0.35, 1, 0.55] as const;

export const STREAM_BAR_TRANSITION = (i: number): Transition => ({
  delay: i * 0.18,
  duration: 0.7,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
});

// Planning breathing dot — single slow inhale/exhale cycle
export const PLAN_DOT_TRANSITION: Transition = {
  duration: 1.8,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
};

// Error icon — spring scale pop on entry for assertive attention
export const ERROR_ICON_VARIANTS: Variants = {
  hidden: { filter: "blur(4px)", opacity: 0, scale: 0.7 },
  visible: { filter: "blur(0px)", opacity: 1, scale: 1 },
};

export const ERROR_ICON_TRANSITION: Transition = {
  damping: 20,
  stiffness: 600,
  type: "spring",
};

// Success check — tight spring pop
export const CHECK_VARIANTS: Variants = {
  hidden: { filter: "blur(4px)", opacity: 0, scale: 0.4 },
  visible: { filter: "blur(0px)", opacity: 1, scale: 1 },
};

export const CHECK_TRANSITION: Transition = {
  damping: 18,
  mass: 0.5,
  stiffness: 520,
  type: "spring",
};

export const LAYOUT_TRANSITION: Transition = {
  damping: 38,
  mass: 0.7,
  stiffness: 450,
  type: "spring",
};

export const CONTAINER_VARIANTS: Variants = {
  hidden: {
    transition: { staggerChildren: 0.02 },
  },
  visible: {
    transition: { delayChildren: 0.02, staggerChildren: 0.04 },
  },
};
