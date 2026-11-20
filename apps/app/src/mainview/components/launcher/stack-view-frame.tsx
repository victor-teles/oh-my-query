import type { Variants } from "motion/react";
import type { ReactNode } from "react";

import { motion, useIsPresent } from "motion/react";

import type { StackDirection } from "./use-launcher-stack";

interface StackViewFrameProps {
  direction: StackDirection;
  variants: Variants;
  children: ReactNode;
}

// A leaving view lingers until its exit spring settles; it must not take
// focus, keys, clicks or screen-reader attention from the view replacing it.
export function StackViewFrame({
  direction,
  variants,
  children,
}: StackViewFrameProps) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      animate="center"
      aria-hidden={isPresent ? undefined : true}
      className="flex min-h-0 flex-col data-[leaving=true]:pointer-events-none"
      custom={direction}
      data-leaving={!isPresent}
      exit="exit"
      inert={!isPresent}
      initial="enter"
      layout="position"
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
