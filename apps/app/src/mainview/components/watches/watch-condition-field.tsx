import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useId } from "react";

import type { SegmentOption } from "@/components/ui/segmented-control";

import { SwapText } from "@/components/motion/swap-text";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMotionPreset } from "@/lib/motion";

import type { ConditionChoice, WatchForm } from "./use-watch-form";

import { needsThreshold } from "./use-watch-form";

const ALL_CONDITIONS: readonly SegmentOption<ConditionChoice>[] = [
  { label: "None", value: "none" },
  { label: "Below", value: "below" },
  { label: "Above", value: "above" },
  { label: "Has rows", value: "hasRows" },
  { label: "Changes", value: "changed" },
];

const ROW_CONDITIONS = ALL_CONDITIONS.filter(
  (option) => !needsThreshold(option.value)
);

interface WatchConditionFieldProps {
  form: WatchForm;
  kpi: boolean;
}

export function WatchConditionField({ form, kpi }: WatchConditionFieldProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const errorId = useId();
  const { dispatch, state, preview, thresholdError } = form;
  const { condition } = state;

  const handleCondition = useCallback(
    (next: ConditionChoice) => dispatch({ condition: next, type: "condition" }),
    [dispatch]
  );
  const handleThreshold = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      dispatch({ threshold: event.target.value, type: "threshold" }),
    [dispatch]
  );

  return (
    <motion.div className="flex flex-col" layout="position">
      <div className="flex min-h-14 items-center justify-between gap-6 px-4 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="type-body text-foreground">Alert</span>
          <span className="type-meta text-panel-muted">
            {kpi
              ? "One notification when it happens, then quiet until it clears."
              : "Thresholds need a KPI widget. Rows and changes work for any."}
          </span>
        </div>
        <SegmentedControl
          label="Alert"
          onChange={handleCondition}
          options={kpi ? ALL_CONDITIONS : ROW_CONDITIONS}
          value={condition}
        />
      </div>
      <AnimatePresence initial={false}>
        {needsThreshold(condition) ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex items-center justify-between gap-6 px-4 pb-3"
            data-motion={reduced ? "instant" : "fade"}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : fadeOut,
            }}
            initial={{ opacity: 0 }}
            key="threshold"
            layout="position"
            transition={reduced ? { duration: 0 } : fadeIn}
          >
            <label
              className="type-meta text-panel-muted"
              htmlFor={`${errorId}-input`}
            >
              {condition === "below" ? "Alert when below" : "Alert when above"}
            </label>
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                className="min-w-12 text-right type-meta text-foreground tabular-nums"
              >
                {preview ? <SwapText value={preview} /> : null}
              </span>
              <Input
                aria-describedby={thresholdError ? errorId : undefined}
                aria-invalid={thresholdError !== null}
                className="w-32 tabular-nums"
                id={`${errorId}-input`}
                inputMode="decimal"
                onChange={handleThreshold}
                placeholder="50000"
                value={state.threshold}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {thresholdError ? (
        <p
          className="px-4 pb-3 type-meta text-danger-ink"
          id={errorId}
          role="alert"
        >
          {thresholdError}
        </p>
      ) : null}
    </motion.div>
  );
}
