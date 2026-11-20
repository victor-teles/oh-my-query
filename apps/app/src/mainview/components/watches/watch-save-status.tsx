import { CheckDraw } from "@/components/motion/check-draw";
import { SwapText } from "@/components/motion/swap-text";

import type { SaveState } from "./use-watch-form";

interface WatchSaveStatusProps {
  save: SaveState;
  idleText: string;
  savedText: string;
  announcement: string;
}

export function WatchSaveStatus({
  save,
  idleText,
  savedText,
  announcement,
}: WatchSaveStatusProps) {
  if (save.kind === "error") {
    return (
      <span className="truncate text-danger-ink" role="alert">
        {save.message}
      </span>
    );
  }
  const saved = save.kind === "saved";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {saved ? <CheckDraw className="shrink-0" label="Saved" /> : null}
      <SwapText
        className={saved ? "truncate text-foreground" : "truncate"}
        value={saved ? savedText : idleText}
      />
      <span aria-live="polite" className="sr-only">
        {saved ? announcement : ""}
      </span>
    </span>
  );
}
