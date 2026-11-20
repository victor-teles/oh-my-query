import { editableParams } from "@conch/rpc";
import { LayoutDashboardIcon } from "lucide-react";
import { useAnimate } from "motion/react";
import { useEffect } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { Widget } from "@/lib/ipc";

import { ConnectionGlyph } from "@/components/launcher/connections/connection-glyph";
import { KeyCombo } from "@/components/launcher/key-combo";
import { LauncherRow } from "@/components/launcher/launcher-row";
import { useMotionPreset } from "@/lib/motion";

import { valuesSummary } from "./param-labels";

const PULSE_SECONDS = 0.9;
const PULSE_OPACITY = 0.14;

interface FreshPulseProps {
  onDone: () => void;
}

// Driven imperatively: rows mount inside AnimatePresence initial={false},
// which would otherwise skip a declarative initial state.
function FreshPulse({ onDone }: FreshPulseProps) {
  const { reduced } = useMotionPreset();
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    if (reduced || !scope.current) {
      onDone();
      return;
    }
    const controls = animate(
      scope.current,
      { opacity: [PULSE_OPACITY, 0] },
      { duration: PULSE_SECONDS, ease: "easeOut" }
    );
    const settle = async () => {
      await controls;
      onDone();
    };
    settle();
    return () => controls.stop();
  }, [animate, onDone, reduced, scope]);

  return reduced ? null : (
    <span
      aria-hidden
      className="absolute inset-0 rounded-[10px] bg-primary opacity-0"
      data-testid="fresh-pulse"
      ref={scope}
    />
  );
}

interface WidgetRowProps {
  id: string;
  widget: Widget;
  connection: DatabaseConnection | null;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
  onPulseDone?: () => void;
}

export function WidgetRow({
  id,
  widget,
  connection,
  selected,
  onHover,
  onRun,
  onPulseDone,
}: WidgetRowProps) {
  const hasInputs = editableParams(widget.params).length > 0;
  const summary = hasInputs ? valuesSummary(widget) : widget.prompt;
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      {onPulseDone ? <FreshPulse onDone={onPulseDone} /> : null}
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
        <span className="truncate type-meta text-panel-muted">{summary}</span>
      </span>
      {selected && hasInputs ? (
        <span className="relative flex shrink-0 items-center gap-1.5 type-meta text-panel-muted">
          Inputs
          <KeyCombo keys={["⇥"]} />
        </span>
      ) : null}
    </LauncherRow>
  );
}
