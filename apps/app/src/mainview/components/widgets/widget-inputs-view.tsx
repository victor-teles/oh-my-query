import type { ChangeEvent, KeyboardEvent } from "react";

import { editableParams, ParamDef as ParamDefSchema } from "@conch/rpc";
import { AnimatePresence } from "motion/react";
import { useCallback, useState } from "react";

import type { ParamDef, ParamValue, Widget, WidgetDraft } from "@/lib/ipc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { SwapText } from "@/components/motion/swap-text";
import { getErrorMessage } from "@/lib/error-message";

import { InputReviewRow } from "./input-review-row";
import { useWidgets } from "./widgets-provider";

export type InputsMode = "create" | "edit";

const HINTS = [
  { keys: ["⌫"], label: "Remove" },
  { keys: ["↑", "↓"], label: "Move" },
] as const;

const inputCount = (count: number): string =>
  count === 1 ? "1 input" : `${count} inputs`;

const withDefault = (param: ParamDef, value: ParamValue): ParamDef =>
  ParamDefSchema.safeParse({ ...param, default: value }).data ?? param;

interface WidgetInputsViewProps {
  draft: WidgetDraft;
  mode: InputsMode;
  onBack: () => void;
  onSaved: (widget: Widget, mode: InputsMode) => void;
}

export function WidgetInputsView({
  draft,
  mode,
  onBack,
  onSaved,
}: WidgetInputsViewProps) {
  const { save } = useWidgets();
  const [params, setParams] = useState<ParamDef[]>(draft.params);
  const [name, setName] = useState(draft.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const visible = editableParams(params);

  const update = useCallback(
    (name: string, change: (param: ParamDef) => ParamDef) =>
      setParams((current) =>
        current.map((param) => (param.name === name ? change(param) : param))
      ),
    []
  );
  const setLabel = useCallback(
    (name: string, label: string) =>
      update(name, (param) => ({ ...param, label })),
    [update]
  );
  const setDefault = useCallback(
    (name: string, value: ParamValue) =>
      update(name, (param) => withDefault(param, value)),
    [update]
  );
  const remove = useCallback(
    (name: string) => {
      const index = visible.findIndex((param) => param.name === name);
      const neighbour = visible.filter((param) => param.name !== name)[
        Math.max(0, index - 1)
      ];
      update(name, (param) => ({ ...param, fixed: true }));
      if (neighbour) {
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(`[data-input-row="${neighbour.name}"]`)
            ?.focus()
        );
      }
    },
    [update, visible]
  );

  const submit = useCallback(async () => {
    if (!name.trim()) {
      setError("Give the widget a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await save({ ...draft, name: name.trim(), params });
      onSaved(saved, mode);
    } catch (error) {
      setError(getErrorMessage(error, "The widget could not be saved."));
    } finally {
      setSaving(false);
    }
  }, [draft, mode, name, onSaved, params, save]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );
  const handleName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown}>
      <ViewHeader
        onBack={onBack}
        title={mode === "create" ? "Save with inputs" : "Edit inputs"}
      />
      <label className="flex items-center gap-3 border-t border-panel-border px-4.5 py-2">
        <span className="w-12 shrink-0 type-meta text-panel-muted">Name</span>
        <input
          aria-label="Widget name"
          className="h-8 min-w-0 flex-1 rounded-[8px] bg-row-hover px-2.5 type-body text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          maxLength={60}
          onChange={handleName}
          spellCheck={false}
          value={name}
        />
      </label>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-panel-border px-2 py-2">
        {visible.length === 0 ? (
          <p className="px-2.5 py-3 type-body text-panel-muted">
            No inputs. The widget always runs the same query.
          </p>
        ) : null}
        <div aria-label="Inputs" className="flex flex-col" role="list">
          <AnimatePresence initial={true}>
            {visible.map((param, index) => (
              <InputReviewRow
                index={index}
                key={param.name}
                onDefault={setDefault}
                onLabel={setLabel}
                onRemove={remove}
                param={param}
              />
            ))}
          </AnimatePresence>
        </div>
        {error ? (
          <p className="px-2.5 pt-2 type-meta text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <LauncherFooter
        actionKeys={["⌘", "↵"]}
        actionLabel={saving ? "Saving…" : "Save"}
        hints={HINTS}
        status={<SwapText value={inputCount(visible.length)} />}
      />
    </div>
  );
}
