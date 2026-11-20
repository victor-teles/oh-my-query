import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const CARD_CHART_HEIGHT = 200;

const BAR_HEIGHTS = [38, 52, 46, 61, 57, 70, 64, 73, 69, 82, 78, 88];

export function AskSkeleton() {
  const { reduced } = useMotionPreset();
  return (
    <div
      aria-hidden
      className={cn("px-4 pb-4", !reduced && "ask-shimmer")}
      data-testid="ask-skeleton"
    >
      <div className="flex gap-3 pt-1 pb-3">
        {[56, 72, 48].map((width) => (
          <span
            className="h-3 rounded-full bg-foreground/[0.06]"
            key={width}
            style={{ width }}
          />
        ))}
      </div>
      <div
        className="flex items-end gap-2 border-b border-foreground/[0.06]"
        style={{ height: CARD_CHART_HEIGHT }}
      >
        {BAR_HEIGHTS.map((height, index) => (
          <span
            className="flex-1 rounded-t-[3px] bg-foreground/[0.06]"
            // Bars are a fixed decorative row.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <span className="mt-3 block h-3 w-2/3 rounded-full bg-foreground/[0.06]" />
    </div>
  );
}
