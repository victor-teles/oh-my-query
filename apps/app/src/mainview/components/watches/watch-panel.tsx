import { intervalPhrase, isKpiSpec } from "@conch/rpc";
import { motion } from "motion/react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { Watch, WatchInterval, WatchStatus, Widget } from "@/lib/ipc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { useMotionPreset } from "@/lib/motion";

import { editableValues, useWatchForm } from "./use-watch-form";
import { useWatchHotkeys } from "./use-watch-hotkeys";
import { WatchConditionField } from "./watch-condition-field";
import { WatchInputsRow } from "./watch-inputs-row";
import { WatchSaveStatus } from "./watch-save-status";
import { savedLine, statusLine, watchingSentence } from "./watch-status-copy";
import { useWatches } from "./watches-provider";

const INTERVALS = [
  { label: "1 min", value: "1m" },
  { label: "5 min", value: "5m" },
  { label: "15 min", value: "15m" },
  { label: "1 hour", value: "1h" },
] as const;

const actionLabelFor = (saving: boolean, watch: Watch | null): string => {
  if (saving) {
    return "Saving…";
  }
  return watch ? "Save" : "Watch";
};

const SAVE_KEYS = ["⌘", "↩"] as const;
const STOP_KEYS = ["⌘", "⌫"] as const;

interface WatchPanelProps {
  widget: Widget;
  watch: Watch | null;
  status: WatchStatus | undefined;
  connection: DatabaseConnection | null;
  onDone: () => void;
}

export function WatchPanel({
  widget,
  watch,
  status,
  connection,
  onDone,
}: WatchPanelProps) {
  const { soft, reduced } = useMotionPreset();
  const { remove } = useWatches();
  const form = useWatchForm({ onSaved: onDone, watch, widget });
  const { dispatch, state, submit } = form;
  const kpi = isKpiSpec(widget.spec);
  const { arm, armed, disarm } = useArmedConfirm();

  const stop = useCallback(async () => {
    if (!watch) {
      return;
    }
    if (!armed) {
      arm();
      return;
    }
    disarm();
    await remove(watch.id);
    onDone();
  }, [arm, armed, disarm, onDone, remove, watch]);
  const handleKeyDown = useWatchHotkeys({
    onSave: submit,
    onStop: watch ? stop : null,
  });
  const handleInterval = useCallback(
    (interval: WatchInterval) => dispatch({ interval, type: "interval" }),
    [dispatch]
  );
  const handleMenuBar = useCallback(
    (menuBar: boolean) => dispatch({ menuBar, type: "menuBar" }),
    [dispatch]
  );
  const lastValues = editableValues(widget);
  const canUseLast =
    JSON.stringify(lastValues) !== JSON.stringify(state.values);
  const handleUseLast = () => dispatch({ type: "values", values: lastValues });
  const hasInputs =
    Object.keys(lastValues).length > 0 || Object.keys(state.values).length > 0;
  const production = connection?.environment === "prod";
  const saving = state.save.kind === "saving";
  const draftWatch = {
    interval: state.interval,
    paused: watch?.paused ?? false,
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleKeyDown}
      role="group"
      aria-label={`Watch ${widget.name}`}
    >
      <ViewHeader onBack={onDone} title={`Watch ${widget.name}`} />
      <div className="min-h-0 flex-1 divide-y divide-panel-border overflow-y-auto border-t border-panel-border pb-2">
        <SettingRow
          description="Runs read-only in the background. On battery, at most every 15 minutes."
          label="Check"
        >
          <SegmentedControl
            label="Check every"
            onChange={handleInterval}
            options={INTERVALS}
            value={state.interval}
          />
        </SettingRow>
        <SettingRow
          description={
            kpi
              ? "Its value sits next to the menu bar icon. One widget at a time."
              : "Only KPI widgets can show in the menu bar."
          }
          label="Show in menu bar"
        >
          {kpi ? (
            <Checkbox
              aria-label="Show in menu bar"
              checked={state.menuBar}
              onCheckedChange={handleMenuBar}
            />
          ) : null}
        </SettingRow>
        <WatchConditionField form={form} kpi={kpi} />
        <motion.div
          layout="position"
          transition={{ layout: reduced ? { duration: 0 } : soft }}
        >
          {hasInputs ? (
            <WatchInputsRow
              onUseLast={canUseLast ? handleUseLast : null}
              values={state.values}
              widget={widget}
            />
          ) : null}
          {production && connection ? (
            <p className="px-4 py-3 type-meta text-panel-muted">
              Runs {intervalPhrase(state.interval)} on {connection.name}{" "}
              (production).
            </p>
          ) : null}
        </motion.div>
      </div>
      <LauncherFooter
        actionKeys={SAVE_KEYS}
        actionLabel={actionLabelFor(saving, watch)}
        hints={
          watch
            ? [
                {
                  keys: STOP_KEYS,
                  label: armed ? "Press again to stop" : "Stop watching",
                },
              ]
            : []
        }
        status={
          <WatchSaveStatus
            announcement={watchingSentence(widget.name, draftWatch)}
            idleText={watch ? statusLine(watch, status) : "Not watched yet"}
            save={state.save}
            savedText={savedLine(draftWatch)}
          />
        }
      />
    </div>
  );
}
