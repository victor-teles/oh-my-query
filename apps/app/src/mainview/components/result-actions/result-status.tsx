import type { ReactNode } from "react";

import { CheckDraw } from "@/components/motion/check-draw";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { ExportStatus } from "./use-result-export";

interface ResultStatusProps {
  status: ExportStatus | null;
  onReveal: () => void;
  fallback: ReactNode;
}

export function ResultStatus({
  status,
  onReveal,
  fallback,
}: ResultStatusProps) {
  const workingShown = useDelayedVisibility(status?.kind === "working");
  if (!status || (status.kind === "working" && !workingShown)) {
    return fallback;
  }
  if (status.kind === "saved") {
    return (
      <span className="flex min-w-0 items-center gap-1.5" role="status">
        <CheckDraw className="shrink-0" label="Saved" />
        <SwapText className="truncate" value={`Saved ${status.fileName}`} />
        <Reveal className="shrink-0">
          <Pressable
            className="rounded-[5px] px-1 text-foreground underline-offset-2 hover:underline"
            onClick={onReveal}
          >
            Show in Finder
          </Pressable>
        </Reveal>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center" role="status">
      <SwapText
        className={
          status.kind === "failed" ? "truncate text-danger-ink" : "truncate"
        }
        value={status.message}
      />
    </span>
  );
}
