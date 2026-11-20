import { CheckDraw } from "@/components/motion/check-draw";
import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { SavePhase } from "./use-ask-save";

const labelFor = (phase: SavePhase, findingShown: boolean): string | null => {
  switch (phase.kind) {
    case "saving": {
      return "Saving…";
    }
    case "saved": {
      return "Saved · ⌥⏎ to run";
    }
    case "finding": {
      return findingShown ? "Finding inputs…" : null;
    }
    case "failed": {
      return phase.during === "inputs"
        ? `${phase.message} ⌘S saves without inputs.`
        : phase.message;
    }
    default: {
      return null;
    }
  }
};

interface SaveStatusProps {
  phase: SavePhase;
}

export function SaveStatus({ phase }: SaveStatusProps) {
  const findingShown = useDelayedVisibility(phase.kind === "finding");
  const label = labelFor(phase, findingShown);
  if (!label) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5" role="status">
      {phase.kind === "saved" ? <CheckDraw label="Saved" /> : null}
      <SwapText
        className={
          phase.kind === "failed" ? "truncate text-danger-ink" : "truncate"
        }
        value={label}
      />
    </span>
  );
}
