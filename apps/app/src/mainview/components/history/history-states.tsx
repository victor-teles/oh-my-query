import { motion } from "motion/react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { useMotionPreset } from "@/lib/motion";

const SKELETON_WIDTHS = [62, 48, 70];

export function HistorySkeleton() {
  const { reduced, fadeIn } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-hidden
      className="flex flex-col gap-1 px-2 pt-7 pb-2"
      data-testid="history-skeleton"
      initial={reduced ? false : { opacity: 0 }}
      transition={fadeIn}
    >
      {SKELETON_WIDTHS.map((width) => (
        <div className="flex h-10 items-center gap-3 px-2.5" key={width}>
          <span className="size-6 rounded-[7px] bg-foreground/[0.06]" />
          <span
            className="h-3 rounded-full bg-foreground/[0.06]"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </motion.div>
  );
}

interface MessageProps {
  title: string;
  detail: string;
}

function HistoryMessage({ title, detail }: MessageProps) {
  return (
    <Reveal className="flex flex-col items-center gap-1 px-6 pt-5 pb-6 text-center">
      <p className="type-body text-foreground" role="status">
        {title}
      </p>
      <p className="type-meta text-panel-muted">{detail}</p>
    </Reveal>
  );
}

export function HistoryEmpty() {
  return (
    <HistoryMessage
      detail="Ask a question from the launcher and it shows up here."
      title="No asks yet."
    />
  );
}

export function HistoryNoMatches({ query }: { query: string }) {
  return (
    <HistoryMessage
      detail="Try another word from the question, the card title or the SQL."
      title={`Nothing matches “${query.trim()}”`}
    />
  );
}

export function HistoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Reveal className="flex flex-col items-center gap-2 px-6 pt-5 pb-6 text-center">
      <p className="type-body text-foreground" role="alert">
        History couldn’t load.
      </p>
      <Pressable
        className="rounded-[7px] bg-row-hover px-2.5 py-1 type-meta text-foreground focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:outline-none"
        onClick={onRetry}
      >
        Retry
      </Pressable>
    </Reveal>
  );
}
