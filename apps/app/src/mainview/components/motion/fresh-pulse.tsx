import { useAnimate } from "motion/react";
import { useEffect } from "react";

import { useMotionPreset } from "@/lib/motion";

const PULSE_SECONDS = 0.9;
const PULSE_OPACITY = 0.14;

interface FreshPulseProps {
  onDone: () => void;
}

// Driven imperatively: rows mount inside AnimatePresence initial={false},
// which would otherwise skip a declarative initial state.
export function FreshPulse({ onDone }: FreshPulseProps) {
  const { reduced } = useMotionPreset();
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    if (reduced || !scope.current) {
      onDone();
      return;
    }
    const controls = animate(
      scope.current,
      { opacity: [PULSE_OPACITY, 0] },
      { duration: PULSE_SECONDS, ease: "easeOut" }
    );
    const settle = async () => {
      await controls;
      onDone();
    };
    settle();
    return () => controls.stop();
  }, [animate, onDone, reduced, scope]);

  return reduced ? null : (
    <span
      aria-hidden
      className="absolute inset-0 rounded-[10px] bg-primary opacity-0"
      data-testid="fresh-pulse"
      ref={scope}
    />
  );
}
