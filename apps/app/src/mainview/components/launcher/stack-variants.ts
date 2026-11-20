import type { Variants } from "motion/react";

import type { MotionPreset } from "@/lib/motion";

import type { StackDirection } from "./use-launcher-stack";

const PUSH_OFFSET = 16;

export const stackVariants = ({
  reduced,
  spring,
  fadeIn,
  fadeOut,
}: MotionPreset): Variants => {
  const offset = (direction: StackDirection) =>
    reduced ? 0 : PUSH_OFFSET * direction;
  return {
    center: { opacity: 1, transition: { ...spring, opacity: fadeIn }, x: 0 },
    enter: (direction: StackDirection) => ({
      opacity: 0,
      x: offset(direction),
    }),
    exit: (direction: StackDirection) => ({
      opacity: 0,
      transition: { ...spring, opacity: fadeOut },
      x: -offset(direction),
    }),
  };
};
