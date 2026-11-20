import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

const RING_SECONDS = 0.6;

interface CopiedRingProps {
  copies: number;
}

export function CopiedRing({ copies }: CopiedRingProps) {
  const { reduced } = useMotionPreset();
  if (reduced || copies === 0) {
    return null;
  }
  return (
    <motion.span
      animate={{ opacity: [0, 0.5, 0] }}
      aria-hidden
      className="pointer-events-none absolute inset-1 rounded-[10px] border border-primary"
      data-testid="copied-ring"
      initial={{ opacity: 0 }}
      key={copies}
      transition={{ duration: RING_SECONDS, ease: "easeOut" }}
    />
  );
}
