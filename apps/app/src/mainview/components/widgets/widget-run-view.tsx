import type { KeyboardEvent } from "react";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { ParamValues, Widget, WidgetDraft } from "@/lib/ipc";

import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { CopiedRing } from "@/components/result-actions/copied-ring";
import { ResultStatus } from "@/components/result-actions/result-status";
import { useResultExport } from "@/components/result-actions/use-result-export";
import { watchActions } from "@/components/watches/watch-actions";
import {
  useWatches,
  watchForWidget,
} from "@/components/watches/watches-provider";

import { WidgetArgumentsRow } from "./arguments/widget-arguments-row";
import { NameField } from "./name-field";
import { currentValues } from "./param-labels";
import { runSpec } from "./run-spec";
import { useWidgetMenu } from "./use-widget-menu";
import { useWidgetRun } from "./use-widget-run";
import { widgetActions } from "./widget-actions";
import { draftFromWidget } from "./widget-draft";
import { WidgetError } from "./widget-error";
import { WidgetRunBody } from "./widget-run-body";
import { WidgetRunMeta } from "./widget-run-meta";
import { useWidgets } from "./widgets-provider";

export const RUN_HEADER_ID = "widget-run-header";

const HINTS = [
  { keys: ["⌘", "K"], label: "Actions" },
  { keys: ["⌘", "C"], label: "Copy SQL" },
] as const;

const hasTextSelection = () => (window.getSelection()?.toString() ?? "") !== "";

interface WidgetRunNavigation {
  onEditInputs: (draft: WidgetDraft) => void;
  onAddToBoard: (widgetId: string) => void;
  onWatch: (widgetId: string) => void;
  onClose: () => void;
}

interface WidgetRunPanelProps extends WidgetRunNavigation {
  widget: Widget;
  initialValues: ParamValues;
}

function WidgetRunPanel({
  widget,
  initialValues,
  onEditInputs,
  onAddToBoard,
  onWatch,
  onClose,
}: WidgetRunPanelProps) {
  const { save } = useWidgets();
  const { watches } = useWatches();
  const { state: connections } = useConnections();
  const [values, setValues] = useState(() => ({
    ...currentValues(widget),
    ...initialValues,
  }));
  const [view, setView] = useState<CardViewKind>(widget.view);
  const [renaming, setRenaming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  const session = useWidgetRun(widget.id, values);
  const { run, cancel, state } = session;
  const shownValues = state.outcome?.values ?? state.values;
  const spec = useMemo(
    () => runSpec(widget, shownValues),
    [shownValues, widget]
  );
  const result = state.outcome?.result;
  const source = useMemo(
    () => (result ? { result, spec, view } : null),
    [result, spec, view]
  );
  const exporter = useResultExport({ cardRef, source });
  const { announce, reveal: handleReveal } = exporter;
  const menu = useWidgetMenu({
    exporter,
    onAddToBoard,
    onDeleted: onClose,
    onEditInputs,
    onRename: () => setRenaming(true),
    onWatch,
    outcome: state.outcome,
    widget,
  });

  const busy = state.status === "running";
  const connection =
    connections.connections.find((item) => item.id === widget.connectionId) ??
    null;
  const actions = widgetActions(
    { hasRows: (result?.rows.length ?? 0) > 0, hasSql: true, view },
    watchActions(widget, watchForWidget(watches, widget.id))
  );

  const selectView = useCallback(
    (next: CardViewKind) => {
      setView(next);
      save({ ...draftFromWidget(widget), view: next });
    },
    [save, widget]
  );
  const rename = useCallback(
    async (name: string) => {
      setRenaming(false);
      await save({ ...draftFromWidget(widget), name });
      announce("Renamed");
    },
    [announce, save, widget]
  );
  const rebind = useCallback(
    async (connectionId: string) => {
      await save({ ...draftFromWidget(widget), connectionId });
      run(values);
    },
    [run, save, values, widget]
  );

  const closeRename = useCallback(() => setRenaming(false), []);
  const retry = useCallback(() => run(values), [run, values]);
  const {
    close: handleCloseMenu,
    run: handleRunAction,
    toggle,
    copySql,
  } = menu;
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape" && busy) {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === "Enter" && event.target === event.currentTarget) {
        event.preventDefault();
        run(values);
        return;
      }
      if (!event.metaKey) {
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "c" && !hasTextSelection()) {
        event.preventDefault();
        copySql();
      }
    },
    [busy, cancel, copySql, run, toggle, values]
  );

  const bodyMinHeight = menu.open ? actionsMenuHeight(actions.length) : 0;

  return (
    // An active pill reserves room for its popover below the 56px input row.
    <div
      aria-label={widget.name}
      className="flex min-h-0 flex-col outline-none has-[[data-active=true]]:min-h-[356px]"
      onKeyDown={handleKeyDown}
      ref={panelRef}
      role="group"
      tabIndex={-1}
    >
      <div id={RUN_HEADER_ID}>
        <WidgetArgumentsRow
          busy={busy}
          controls={{ onChange: setValues, onRun: run, onStop: cancel }}
          initialFocus="none"
          values={values}
          widget={widget}
        />
      </div>
      <AnimatePresence initial={false}>
        {renaming ? (
          <NameField
            initial={widget.name}
            label="Rename"
            onCancel={closeRename}
            onConfirm={rename}
          />
        ) : null}
      </AnimatePresence>
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-panel-border"
        style={{ minHeight: bodyMinHeight }}
      >
        <WidgetRunMeta connection={connection} outcome={state.outcome} />
        {state.status === "error" && state.failure ? (
          <WidgetError
            connections={connections.connections}
            failure={state.failure}
            onRebind={rebind}
            onRetry={retry}
          />
        ) : (
          <WidgetRunBody
            cardRef={cardRef}
            onSelectView={selectView}
            run={state}
            slots={{ overlay: <CopiedRing copies={exporter.chartCopies} /> }}
            spec={spec}
            view={view}
          />
        )}
        <AnimatePresence>
          {menu.open ? (
            <ActionsMenu
              actions={actions}
              anchorId={RUN_HEADER_ID}
              armedId={menu.armed ? "delete" : null}
              onClose={handleCloseMenu}
              onRun={handleRunAction}
              title={widget.name}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <LauncherFooter
        actionLabel={busy ? "Running" : "Run"}
        hints={HINTS}
        status={
          <ResultStatus
            fallback={null}
            onReveal={handleReveal}
            status={exporter.status}
          />
        }
      />
    </div>
  );
}

interface WidgetRunViewProps extends WidgetRunNavigation {
  widgetId: string;
  initialValues: ParamValues;
}

export function WidgetRunView({
  widgetId,
  initialValues,
  onEditInputs,
  onAddToBoard,
  onWatch,
  onClose,
}: WidgetRunViewProps) {
  const { widgets, status } = useWidgets();
  const widget = widgets.find((item) => item.id === widgetId);
  if (!widget) {
    return (
      <div className="flex min-h-0 flex-col">
        <p className="px-4 py-6 type-body text-panel-muted" role="status">
          {status === "loading"
            ? "Loading widget…"
            : "This widget no longer exists."}
        </p>
      </div>
    );
  }
  return (
    <WidgetRunPanel
      initialValues={initialValues}
      onAddToBoard={onAddToBoard}
      onClose={onClose}
      onEditInputs={onEditInputs}
      onWatch={onWatch}
      widget={widget}
    />
  );
}
