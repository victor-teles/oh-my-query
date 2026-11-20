import { useAnimate } from "motion/react";
import { useEffect, useState } from "react";

import { useMotionPreset } from "@/lib/motion";

import type { TileCueState } from "./board-tile";

const TINT_MS = 600;
const PULSE_MS = 900;
const PULSE_OPACITY = 0.14;

function FilterTint({ token }: { token: number }) {
  const { reduced } = useMotionPreset();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduced) {
      const timer = window.setTimeout(() => setVisible(false), TINT_MS);
      return () => window.clearTimeout(timer);
    }
    if (!scope.current) {
      return;
    }
    const controls = animate(
      scope.current,
      { opacity: [1, 0] },
      { duration: TINT_MS / 1000, ease: [0.4, 0, 1, 1] }
    );
    const fade = async () => {
      await controls;
      setVisible(false);
    };
    fade();
    return () => controls.stop();
  }, [animate, reduced, scope, token]);

  return visible ? (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 rounded-[14px] ring-2 ring-primary/70 ring-inset"
      data-testid="filter-tint"
      ref={scope}
    />
  ) : null;
}

function FreshPulse() {
  const { reduced } = useMotionPreset();
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    if (reduced || !scope.current) {
      return;
    }
    const controls = animate(
      scope.current,
      { opacity: [PULSE_OPACITY, 0] },
      { duration: PULSE_MS / 1000, ease: "easeOut" }
    );
    return () => controls.stop();
  }, [animate, reduced, scope]);

  return reduced ? null : (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 rounded-[14px] bg-primary opacity-0"
      data-testid="fresh-tile-pulse"
      ref={scope}
    />
  );
}

export function TileCue({ cue }: { cue: TileCueState }) {
  return (
    <>
      {cue.tint === null ? null : (
        <FilterTint key={cue.tint} token={cue.tint} />
      )}
      {cue.fresh ? <FreshPulse /> : null}
    </>
  );
}
