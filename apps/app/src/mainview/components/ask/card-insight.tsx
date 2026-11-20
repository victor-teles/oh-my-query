import { DotIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { useMotionPreset } from "@/lib/motion";

export type Trend = "up" | "down" | "flat";

const GLYPHS = {
  down: TrendingDownIcon,
  flat: DotIcon,
  up: TrendingUpIcon,
} as const;

const INSIGHT_DELAY_S = 0.12;

interface CardInsightProps {
  text: string;
  trend: Trend;
  delay?: number;
}

export function CardInsight({
  text,
  trend,
  delay = INSIGHT_DELAY_S,
}: CardInsightProps) {
  const { reduced } = useMotionPreset();
  const Glyph = GLYPHS[trend];
  return (
    <Reveal className="flex gap-2 px-4 pt-1 pb-4" delay={reduced ? 0 : delay}>
      <Glyph
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 text-panel-muted"
      />
      <p className="line-clamp-2 type-body text-panel-muted">{text}</p>
    </Reveal>
  );
}
