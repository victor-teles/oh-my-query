import { editableParams } from "@oh-my-query/rpc";
import { LayoutDashboardIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { WatchGlyphKind } from "@/components/watches/watch-glyph";
import type { TrendFailure } from "@/components/watches/widget-trend";
import type { DatabaseConnection } from "@/lib/connections";
import type { Widget, WidgetTrend as WidgetTrendData } from "@/lib/ipc";

import { ConnectionGlyph } from "@/components/launcher/connections/connection-glyph";
import { KeyCombo } from "@/components/launcher/key-combo";
import { LauncherRow } from "@/components/launcher/launcher-row";
import { FreshPulse } from "@/components/motion/fresh-pulse";
import { WatchGlyph } from "@/components/watches/watch-glyph";
import { WidgetTrend } from "@/components/watches/widget-trend";
import { useMotionPreset } from "@/lib/motion";

import { valuesSummary } from "./param-labels";

export interface WidgetWatching {
  glyph: WatchGlyphKind | null;
  trend: WidgetTrendData | null;
  failure: TrendFailure | null;
}

export const NOT_WATCHING: WidgetWatching = {
  failure: null,
  glyph: null,
  trend: null,
};

interface WidgetRowEvents {
  onHover: (id: string) => void;
  onRun: (id: string) => void;
  onPulseDone?: () => void;
}

interface WidgetRowProps {
  id: string;
  widget: Widget;
  connection: DatabaseConnection | null;
  selected: boolean;
  events: WidgetRowEvents;
  watching?: WidgetWatching;
}

function GlyphSlot({ kind }: { kind: WatchGlyphKind | null }) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 };
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {kind ? (
        <motion.span
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex shrink-0 items-center self-center"
          data-motion={reduced ? "fade" : "pop"}
          exit={{ ...hidden, transition: fadeOut }}
          initial={hidden}
          key={kind}
          transition={fadeIn}
        >
          <WatchGlyph kind={kind} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

export function WidgetRow({
  id,
  widget,
  connection,
  selected,
  events,
  watching = NOT_WATCHING,
}: WidgetRowProps) {
  const hasInputs = editableParams(widget.params).length > 0;
  const summary = hasInputs ? valuesSummary(widget) : widget.prompt;
  const {
    onHover: handleHover,
    onRun: handleRun,
    onPulseDone: handlePulseDone,
  } = events;
  return (
    <LauncherRow
      id={id}
      onHover={handleHover}
      onRun={handleRun}
      selected={selected}
    >
      {handlePulseDone ? <FreshPulse onDone={handlePulseDone} /> : null}
      {connection ? (
        <ConnectionGlyph className="relative" connection={connection} />
      ) : (
        <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
          <LayoutDashboardIcon aria-hidden className="size-3.5" />
        </span>
      )}
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">
          {widget.name}
        </span>
        <GlyphSlot kind={watching.glyph} />
        <span className="truncate type-meta text-panel-muted">{summary}</span>
      </span>
      <WidgetTrend
        failure={watching.failure}
        spec={widget.spec}
        trend={watching.trend}
        widgetId={widget.id}
      />
      {selected && hasInputs ? (
        <span className="relative flex shrink-0 items-center gap-1.5 type-meta text-panel-muted">
          Inputs
          <KeyCombo keys={["⇥"]} />
        </span>
      ) : null}
    </LauncherRow>
  );
}
