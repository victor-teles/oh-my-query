import { HistoryIcon } from "lucide-react";
import { motion } from "motion/react";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { FADE_OUT, staggerDelay, useMotionPreset } from "@/lib/motion";

import type { HistoryMatch } from "./history-search";

const LAST_STAGGERED = 5;

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const DAY_IN_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const askedWhen = (askedAt: string, now: Date): string => {
  const date = new Date(askedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  if (sameDay(date, now)) {
    return TIME.format(date);
  }
  return date.getFullYear() === now.getFullYear()
    ? DAY.format(date)
    : DAY_IN_YEAR.format(date);
};

// Rows leave bottom-up before the list empties, so the wait covers the
// longest stagger plus one fade.
export const clearOutMs = (reduced: boolean): number =>
  reduced ? 0 : (staggerDelay(LAST_STAGGERED) + FADE_OUT.duration) * 1000;

export interface HistoryRowContext {
  selectedId: string | null;
  now: Date;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export interface RowMotion {
  index: number;
  count: number;
  intro: boolean;
  leaving: boolean;
}

interface PromptRun {
  start: number;
  text: string;
  hit: boolean;
}

const promptRuns = (prompt: string, matches: readonly number[]) => {
  const hits = new Set(matches);
  const runs: PromptRun[] = [];
  for (let index = 0; index < prompt.length; index += 1) {
    const hit = hits.has(index);
    const last = runs.at(-1);
    if (last?.hit === hit) {
      last.text += prompt.charAt(index);
    } else {
      runs.push({ hit, start: index, text: prompt.charAt(index) });
    }
  }
  return runs;
};

function HighlightedPrompt({
  prompt,
  matches,
}: {
  prompt: string;
  matches: readonly number[];
}) {
  if (matches.length === 0) {
    return prompt;
  }
  return promptRuns(prompt, matches).map((run) => (
    <span
      className={run.hit ? "font-medium text-foreground" : "text-panel-muted"}
      key={run.start}
    >
      {run.text}
    </span>
  ));
}

interface HistoryRowProps {
  match: HistoryMatch;
  context: HistoryRowContext;
  motion: RowMotion;
}

export function HistoryRow({
  match,
  context,
  motion: rowMotion,
}: HistoryRowProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const { ask, connectionName } = match.entry;
  const { index, count, intro, leaving } = rowMotion;
  const staggered = intro && !reduced;
  const delay = leaving ? staggerDelay(count - 1 - index) : staggerDelay(index);
  const when = askedWhen(ask.askedAt, context.now);
  const { onHover: handleHover, onRun: handleRun } = context;

  return (
    <motion.div
      animate={{ opacity: leaving ? 0 : 1, y: 0 }}
      data-motion={staggered ? "stagger" : "instant"}
      initial={staggered ? { opacity: 0, y: 4 } : false}
      transition={{
        opacity: {
          ...(leaving ? fadeOut : fadeIn),
          delay: reduced ? 0 : delay,
        },
        y: { ...fadeIn, delay },
      }}
    >
      <LauncherRow
        id={match.id}
        onHover={handleHover}
        onRun={handleRun}
        selected={match.id === context.selectedId}
      >
        <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
          <HistoryIcon aria-hidden className="size-3.5" />
        </span>
        <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate type-body text-foreground">
            <HighlightedPrompt
              matches={match.promptMatches}
              prompt={ask.prompt}
            />
          </span>
          <span className="max-w-[55%] min-w-0 truncate type-meta text-panel-muted">
            <span className={connectionName === null ? "italic" : undefined}>
              {connectionName ?? "connection removed"}
            </span>
            {[ask.spec.title, when]
              .filter(Boolean)
              .map((part) => ` · ${part}`)
              .join("")}
          </span>
        </span>
      </LauncherRow>
    </motion.div>
  );
}
