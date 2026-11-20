import type { HTMLMotionProps } from "motion/react";

import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

type PressableProps = Omit<HTMLMotionProps<"button">, "whileTap"> & {
  ref?: React.Ref<HTMLButtonElement>;
};

export function Pressable({ type = "button", ...props }: PressableProps) {
  const { pressed, press } = useMotionPreset();
  return (
    <motion.button
      type={type}
      whileTap={{ ...pressed, transition: press }}
      {...props}
    />
  );
}
