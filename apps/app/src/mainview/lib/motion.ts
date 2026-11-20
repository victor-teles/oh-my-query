import type { Easing } from "motion/react";

import { useReducedMotion } from "motion/react";

export interface SpringTransition {
  type: "spring";
  stiffness: number;
  damping: number;
}

export interface TweenTransition {
  duration: number;
  ease: Easing | Easing[];
}

export type MotionTransition = SpringTransition | TweenTransition;

const SLOWMO_PARAM = "slowmo";
const SLOWMO_STORAGE_KEY = "conch:slowmo";
const MAX_SLOWMO = 20;

interface SlowMotionSource {
  isDev: boolean;
  search: string;
  stored: string | null;
}

const parseFactor = (raw: string | null): number | null => {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 && value <= MAX_SLOWMO
    ? value
    : null;
};

export const readSlowMotionFactor = ({
  isDev,
  search,
  stored,
}: SlowMotionSource): number => {
  if (!isDev) {
    return 1;
  }
  const fromQuery = parseFactor(new URLSearchParams(search).get(SLOWMO_PARAM));
  return fromQuery ?? parseFactor(stored) ?? 1;
};

export const scaleTransition = <T extends MotionTransition>(
  transition: T,
  factor: number
): T => {
  if (factor === 1) {
    return transition;
  }
  if ("type" in transition) {
    // Stretching a spring's timeline by N keeps its damping ratio: k/N², c/N.
    return {
      ...transition,
      damping: transition.damping / factor,
      stiffness: transition.stiffness / (factor * factor),
    };
  }
  return { ...transition, duration: transition.duration * factor };
};

const readStoredFactor = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(SLOWMO_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
};

const SLOWMO = readSlowMotionFactor({
  isDev: import.meta.env.DEV,
  search: globalThis.location?.search ?? "",
  stored: readStoredFactor(),
});

const scaled = <T extends MotionTransition>(transition: T): T =>
  scaleTransition(transition, SLOWMO);

export const SPRING = scaled<SpringTransition>({
  damping: 30,
  stiffness: 400,
  type: "spring",
});

export const SPRING_SNAPPY = scaled<SpringTransition>({
  damping: 49,
  stiffness: 600,
  type: "spring",
});

export const SPRING_SOFT = scaled<SpringTransition>({
  damping: 32,
  stiffness: 260,
  type: "spring",
});

export const SPRING_MOMENTUM = scaled<SpringTransition>({
  damping: 26,
  stiffness: 380,
  type: "spring",
});

export const FADE_IN = scaled<TweenTransition>({
  duration: 0.16,
  ease: [0.23, 1, 0.32, 1],
});

export const FADE_OUT = scaled<TweenTransition>({
  duration: 0.11,
  ease: [0.4, 0, 1, 1],
});

export const DRAW = scaled<TweenTransition>({
  duration: 0.22,
  ease: [0.23, 1, 0.32, 1],
});

export const PRESS = scaled<TweenTransition>({
  duration: 0.1,
  ease: "easeOut",
});

export const REDUCED_FADE = scaled<TweenTransition>({
  duration: 0.12,
  ease: "linear",
});

export const PRESS_SCALE = 0.97;
export const REDUCED_PRESS_OPACITY = 0.85;

const STAGGER = 0.03;
const STAGGER_LIMIT = 6;

export const staggerDelay = (index: number): number =>
  Math.min(index, STAGGER_LIMIT - 1) * STAGGER * SLOWMO;

export interface MotionPreset {
  reduced: boolean;
  spring: MotionTransition;
  snappy: MotionTransition;
  soft: MotionTransition;
  fadeIn: MotionTransition;
  fadeOut: MotionTransition;
  press: MotionTransition;
  pressed: { scale: number } | { opacity: number };
}

const FULL_PRESET: MotionPreset = {
  fadeIn: FADE_IN,
  fadeOut: FADE_OUT,
  press: PRESS,
  pressed: { scale: PRESS_SCALE },
  reduced: false,
  snappy: SPRING_SNAPPY,
  soft: SPRING_SOFT,
  spring: SPRING,
};

const REDUCED_PRESET: MotionPreset = {
  fadeIn: REDUCED_FADE,
  fadeOut: REDUCED_FADE,
  press: REDUCED_FADE,
  pressed: { opacity: REDUCED_PRESS_OPACITY },
  reduced: true,
  snappy: REDUCED_FADE,
  soft: REDUCED_FADE,
  spring: REDUCED_FADE,
};

export const motionPreset = (reduced: boolean): MotionPreset =>
  reduced ? REDUCED_PRESET : FULL_PRESET;

export const useMotionPreset = (): MotionPreset =>
  motionPreset(useReducedMotion() ?? false);
