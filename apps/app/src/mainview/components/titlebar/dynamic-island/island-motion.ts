import type { Transition } from "motion/react";

export const PILL_LAYOUT_TRANSITION: Transition = {
  damping: 30,
  stiffness: 400,
  type: "spring",
};

export const PILL_PRESENCE_TRANSITION: Transition = {
  damping: 30,
  stiffness: 400,
  type: "spring",
};

export const CONTENT_CROSSFADE_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

export const CONTENT_CROSSFADE_INITIAL = {
  filter: "blur(3px)",
  opacity: 0,
} as const;

export const CONTENT_CROSSFADE_ANIMATE = {
  filter: "blur(0px)",
  opacity: 1,
} as const;

export const INDICATOR_LOOP_TRANSITION = (delay = 0): Transition => ({
  delay,
  duration: 1.4,
  ease: "easeInOut",
  repeat: Number.POSITIVE_INFINITY,
  repeatType: "mirror",
});

export const INDICATOR_DOT_STAGGER_S = 0.18;

export const STREAM_BAR_HEIGHTS = [0.35, 1, 0.55] as const;
