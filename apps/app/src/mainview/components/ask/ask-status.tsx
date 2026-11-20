import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface StatusLabel {
  primary: string;
  secondary: string | null;
}

interface AskStatusProps {
  label: StatusLabel;
  busy: boolean;
}

export function AskStatus({ label, busy }: AskStatusProps) {
  const { reduced } = useMotionPreset();
  const announcement = [label.primary, label.secondary]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
      <span aria-hidden className="grid h-4 w-3 place-items-center">
        <span
          className={cn(
            "block rounded-full",
            busy && !reduced
              ? "size-3 animate-spin border-[1.5px] border-panel-muted/40 border-t-panel-muted"
              : "size-1.5 bg-panel-muted"
          )}
          data-testid="status-mark"
        />
      </span>
      <div aria-hidden className="flex min-w-0 flex-col gap-0.5">
        <SwapText className="type-body text-foreground" value={label.primary} />
        {label.secondary ? (
          <SwapText
            className="truncate type-meta text-panel-muted"
            value={label.secondary}
          />
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
