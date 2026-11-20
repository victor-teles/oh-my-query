import { motion } from "motion/react";
import { useCallback } from "react";

import type { ParamValues, Widget } from "@/lib/ipc";

import { LauncherInputRow } from "@/components/launcher/launcher-input-row";
import { useMotionPreset } from "@/lib/motion";

import type { PillFocus } from "./argument-pills";

import { ArgumentPills, widgetInputs } from "./argument-pills";

export interface ArgumentControls {
  onChange: (values: ParamValues) => void;
  onRun: (values: ParamValues) => void;
  onStop?: () => void;
  onExit?: () => void;
}

interface WidgetArgumentsRowProps {
  widget: Widget;
  values: ParamValues;
  busy: boolean;
  initialFocus: PillFocus;
  controls: ArgumentControls;
}

export function WidgetArgumentsRow({
  widget,
  values,
  busy,
  initialFocus,
  controls,
}: WidgetArgumentsRowProps) {
  const { reduced, spring } = useMotionPreset();
  const { onChange, onRun, onStop, onExit } = controls;
  const handleSubmit = useCallback(() => onRun(values), [onRun, values]);
  return (
    <LauncherInputRow busy={busy} onStop={onStop} onSubmit={handleSubmit}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <motion.h2
          animate={{ opacity: 1, x: 0 }}
          className="max-w-[40%] shrink-0 truncate type-input text-foreground"
          initial={reduced ? false : { opacity: 0.6, x: 4 }}
          layout="position"
          transition={spring}
        >
          {widget.name}
        </motion.h2>
        <ArgumentPills
          initialFocus={initialFocus}
          inputs={widgetInputs(widget)}
          label={`${widget.name} inputs`}
          onChange={onChange}
          onExit={onExit}
          onSubmit={onRun}
          values={values}
        />
      </div>
    </LauncherInputRow>
  );
}
