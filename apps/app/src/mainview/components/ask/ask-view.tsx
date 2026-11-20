import type { RefObject } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo } from "react";

import type { WidgetDraft } from "@/lib/ipc";

import { ConnectionStatus } from "@/components/launcher/connection-status";
import { ActiveConnectionChip } from "@/components/launcher/connections/active-connection-chip";
import { databaseTypeLabel } from "@/components/launcher/connections/connection-search";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import { ResultStatus } from "@/components/result-actions/result-status";
import { NameField } from "@/components/widgets/name-field";
import { SaveStatus } from "@/components/widgets/save-status";
import { useAskSave } from "@/components/widgets/use-ask-save";
import { defaultWidgetName } from "@/components/widgets/widget-draft";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { useMotionPreset } from "@/lib/motion";

import type { ErrorAction } from "./ask-error";
import type { SaveAvailability } from "./ask-footer-hints";
import type { AskSession } from "./use-ask";

import {
  AskActionsLayer,
  askCardSlots,
  askOverlayHeight,
} from "./ask-actions-layer";
import { answeredOf, saveUnavailableOf, viewsOf } from "./ask-answer";
import { AskBody } from "./ask-body";
import { askFooterHints, chainHintOf } from "./ask-footer-hints";
import { askAnnouncement, headerSegments, statusLabel } from "./ask-labels";
import { isWorking, shownTurn } from "./ask-reducer";
import { AskSqlSection, blockStateOf } from "./ask-sql-section";
import { trailOf } from "./ask-trail";
import { AssumptionsLine } from "./assumptions-line";
import { DrillProvider } from "./drill-context";
import { queryKindOf } from "./query-kind";
import { QuestionTrail } from "./question-trail";
import { RefineOverlay } from "./refine-overlay";
import { useAskActionsMenu } from "./use-ask-actions-menu";
import { useAskDrill } from "./use-ask-drill";
import { useAskInputFocus } from "./use-ask-input-focus";
import { useAskKeyboard } from "./use-ask-keyboard";
import { bodyKeyOf, usePhaseDisplay } from "./use-phase-display";
import { useRefineInput } from "./use-refine-input";

const NAME_LABELS = { board: "Name the widget to add", save: "Widget name" };

const saveAvailabilityOf = (
  canSave: boolean,
  unavailable: boolean
): SaveAvailability => {
  if (canSave) {
    return "available";
  }
  return unavailable ? "unavailable" : "none";
};
const CHIP = <ActiveConnectionChip />;
const STATUS = <ConnectionStatus />;

interface AskViewProps {
  session: AskSession;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenSettings: () => void;
  onReviewInputs: (draft: WidgetDraft) => void;
  onRunWidget: (widgetId: string) => void;
  onAddToBoard: (widgetId: string) => void;
}

export function AskView({
  session,
  inputRef,
  onOpenSettings,
  onReviewInputs,
  onRunWidget,
  onAddToBoard,
}: AskViewProps) {
  const { activeConnection } = useConnections();
  const { state, cancel, selectView, stepTurn, toggleSql } = session;
  const body = usePhaseDisplay(state);
  const { copied, copy } = useCopyFeedback();
  const { soft, fadeIn, fadeOut } = useMotionPreset();
  const busy = isWorking(state.status);
  const name = activeConnection?.name ?? "";
  const views = viewsOf(state);
  const answered = useMemo(
    () => (busy ? null : answeredOf(state, activeConnection?.id)),
    [activeConnection?.id, busy, state]
  );
  const unavailable = !busy && saveUnavailableOf(state);
  const saving = useAskSave({
    answered,
    onReviewInputs,
    onSavedForBoard: onAddToBoard,
    unavailable,
  });
  const { phase } = saving;
  const field = useAskInputFocus(inputRef, saving);
  const { closeNaming: handleCloseNaming, confirmName: handleConfirmName } =
    field;
  const input = useRefineInput({
    connection: activeConnection,
    inputRef: field.fieldRef,
    onAltEnter:
      phase.kind === "saved" ? () => onRunWidget(phase.widget.id) : null,
    session,
    views,
  });
  const { prefill: handlePrefill, retry } = input;
  const drill = useAskDrill({
    connection: activeConnection,
    focusInput: field.focusInput,
    prefill: handlePrefill,
    state,
  });
  const copySql = useCallback(() => {
    if (state.sql) {
      copy(state.sql);
    }
  }, [copy, state.sql]);
  const menu = useAskActionsMenu({
    canSave: answered !== null,
    copySql,
    focusInput: field.focusInput,
    onAddToBoard,
    saving,
    state,
  });
  const handleErrorAction = useCallback(
    (action: Exclude<ErrorAction, null>) =>
      action === "settings" ? onOpenSettings() : retry(),
    [onOpenSettings, retry]
  );
  const handleKeyDown = useAskKeyboard({
    busy,
    onCancel: cancel,
    onCopySql: copySql,
    onFindInputs: saving.findInputs,
    onSave: saving.beginNaming,
    onSelectView: selectView,
    onToggleActions: menu.toggle,
    onToggleDrill: drill.toggle,
    onToggleSql: toggleSql,
    views,
  });
  const card = { ref: menu.cardRef, slots: askCardSlots(menu, drill) };
  const handleReveal = menu.exporter.reveal;
  const idle = phase.kind === "idle" || phase.kind === "naming";
  const turn = shownTurn(state);
  const kind = queryKindOf(state.dialect, activeConnection?.type);
  const save = saveAvailabilityOf(answered !== null, unavailable);

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown}>
      <LauncherInput
        busy={busy}
        chip={CHIP}
        inputProps={{
          "aria-label": "Ask a question",
          "aria-placeholder": input.placeholder,
          autoFocus: true,
          onChange: input.handleChange,
          onKeyDown: input.handleKeyDown,
          ref: field.attachField,
          value: input.draft,
        }}
        onStop={cancel}
        onSubmit={input.handleSubmit}
        overlay={<RefineOverlay {...input.overlay} />}
      />
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-panel-border"
        style={{ minHeight: askOverlayHeight(menu, drill) }}
      >
        <QuestionTrail
          crumbs={trailOf(state)}
          onStep={stepTurn}
          position={state.position}
        />
        <AskSqlSection
          copied={copied}
          kind={kind}
          onCopy={copySql}
          onToggle={toggleSql}
          segments={headerSegments(
            state,
            activeConnection ? databaseTypeLabel(activeConnection.type) : "SQL",
            name,
            kind
          )}
          state={state}
        />
        <AssumptionsLine
          assumptions={turn?.assumptions ?? null}
          interactive={drill.target !== null}
          onPrefill={handlePrefill}
        />
        <AnimatePresence initial={false}>
          {phase.kind === "naming" && answered ? (
            <NameField
              initial={defaultWidgetName(answered.spec)}
              label={NAME_LABELS[phase.intent]}
              onCancel={handleCloseNaming}
              onConfirm={handleConfirmName}
            />
          ) : null}
        </AnimatePresence>
        <motion.div
          layout={blockStateOf(state) === "streaming" ? false : "position"}
          transition={{ layout: soft }}
        >
          <DrillProvider target={drill.target}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: fadeOut }}
                initial={{ opacity: 0 }}
                key={bodyKeyOf(body)}
                transition={fadeIn}
              >
                <AskBody
                  card={card}
                  kind={body}
                  label={statusLabel(state, name, kind)}
                  onErrorAction={handleErrorAction}
                  onSelectView={selectView}
                  state={state}
                />
              </motion.div>
            </AnimatePresence>
          </DrillProvider>
        </motion.div>
        <AskActionsLayer menu={menu} title={turn?.answer.spec.title ?? "SQL"} />
        <p aria-live="polite" className="sr-only">
          {input.notice ?? askAnnouncement(state)}
        </p>
      </div>
      <LauncherFooter
        actionLabel={input.actionLabel}
        hints={askFooterHints({
          busy,
          chain: chainHintOf(state),
          hasSql: state.sql !== "",
          reporting: menu.exporter.status !== null,
          save,
        })}
        status={
          <ResultStatus
            fallback={idle ? STATUS : <SaveStatus phase={phase} />}
            onReveal={handleReveal}
            status={menu.exporter.status}
          />
        }
      />
    </div>
  );
}
