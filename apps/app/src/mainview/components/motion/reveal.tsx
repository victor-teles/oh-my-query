import type { ReactNode } from "react";

import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const { reduced, fadeIn } = useMotionPreset();
  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      className={className}
      initial={
        reduced ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0, y: 4 }
      }
      transition={{ ...fadeIn, delay }}
    >
      {children}
    </motion.div>
  );
}
