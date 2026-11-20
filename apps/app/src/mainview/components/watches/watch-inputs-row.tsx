import { RotateCcwIcon } from "lucide-react";

import type { ParamValues, Widget } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { valuesSummary } from "@/components/widgets/param-labels";

interface WatchInputsRowProps {
  widget: Widget;
  values: ParamValues;
  onUseLast: (() => void) | null;
}

export function WatchInputsRow({
  widget,
  values,
  onUseLast,
}: WatchInputsRowProps) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body text-foreground">Inputs</span>
        <SwapText
          className="truncate type-meta text-panel-muted"
          value={valuesSummary(widget, values)}
        />
      </div>
      {onUseLast ? (
        <Pressable
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
          onClick={onUseLast}
        >
          <RotateCcwIcon aria-hidden className="size-3" />
          Use the inputs from your last run
        </Pressable>
      ) : null}
    </div>
  );
}
