import { LoaderIcon, XIcon } from "lucide-react";

import { CheckDraw } from "@/components/motion/check-draw";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { AiTestState } from "./ai-settings-reducer";

interface AiTestResultProps {
  test: AiTestState;
}

export function AiTestResult({ test }: AiTestResultProps) {
  const showBusy = useDelayedVisibility(test.status === "testing");

  if (test.status === "done") {
    const { ok, message, latencyMs } = test.result;
    return (
      <Reveal className="flex items-center gap-2 px-4 pb-3 type-meta">
        {ok ? (
          <CheckDraw label="Test passed" />
        ) : (
          <XIcon
            aria-label="Test failed"
            className="size-3.5 shrink-0 text-danger-ink"
            role="img"
          />
        )}
        <span
          className={ok ? "text-foreground" : "text-danger-ink"}
          role="status"
        >
          {message}
        </span>
        {ok ? (
          <SwapText
            className="ml-auto font-mono text-[11px] text-panel-muted"
            value={`${latencyMs} ms`}
          />
        ) : null}
      </Reveal>
    );
  }
  if (test.status === "testing" && showBusy) {
    return (
      <Reveal className="flex items-center gap-2 px-4 pb-3 type-meta text-panel-muted">
        <LoaderIcon aria-hidden className="size-3.5 animate-spin" />
        <span role="status">Asking the model for a one-word reply…</span>
      </Reveal>
    );
  }
  return null;
}
