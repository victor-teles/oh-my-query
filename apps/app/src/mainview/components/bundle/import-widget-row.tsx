import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { Bundle } from "@/lib/ipc";

import { SqlBlock } from "@/components/ask/sql-block";
import { KeyCombo } from "@/components/launcher/key-combo";
import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

import type { WidgetChoice } from "./import-reducer";

import { paramSummary } from "./bundle-labels";
import { ImportCheckbox } from "./import-checkbox";

export const DIMMED_OPACITY = 0.5;

const optionQueries = (params: Bundle["widgets"][number]["params"]) =>
  params.flatMap((param) =>
    param.type === "select" && param.optionsSql
      ? [{ label: param.label, sql: param.optionsSql }]
      : []
  );

export interface WidgetRowState {
  choice: WidgetChoice;
  duplicate: boolean;
  expanded: boolean;
}

interface ImportWidgetRowProps {
  widget: Bundle["widgets"][number];
  state: WidgetRowState;
  connectionName: string | null;
  autoFocus: boolean;
  onToggle: (ref: string) => void;
  onToggleSql: (ref: string) => void;
}

export function ImportWidgetRow({
  widget,
  state,
  connectionName,
  autoFocus,
  onToggle,
  onToggleSql,
}: ImportWidgetRowProps) {
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  const instant = { duration: 0 };
  const { ref } = widget;
  const on = state.choice === "on";
  const unmapped = state.choice === "unmapped";
  const handleToggle = useCallback(() => onToggle(ref), [onToggle, ref]);
  const handleSql = useCallback(() => onToggleSql(ref), [onToggleSql, ref]);
  const detail = unmapped
    ? "Choose a connection"
    : `${connectionName ?? ""} · ${paramSummary(widget.params)}`;

  return (
    <div data-import-row data-widget-ref={ref}>
      <motion.div
        animate={{ opacity: on ? 1 : DIMMED_OPACITY }}
        className="flex items-center gap-1"
        initial={false}
        transition={reduced ? instant : fadeIn}
      >
        <ImportCheckbox
          autoFocus={autoFocus}
          checked={on}
          onToggle={handleToggle}
          unavailable={unmapped}
        >
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate type-body text-foreground">
              {widget.name}
            </span>
            <span className="truncate type-meta text-panel-muted">
              {detail}
            </span>
          </span>
          {state.duplicate ? (
            <span className="shrink-0 rounded-[5px] bg-row-hover px-1.5 py-0.5 type-micro text-panel-muted">
              Already here
            </span>
          ) : null}
        </ImportCheckbox>
        <Pressable
          aria-expanded={state.expanded}
          aria-label={`${state.expanded ? "Hide" : "Show"} SQL for ${widget.name}`}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground"
          onClick={handleSql}
          tabIndex={-1}
        >
          SQL
          <KeyCombo keys={["⌘", "E"]} />
        </Pressable>
      </motion.div>
      <AnimatePresence initial={false}>
        {state.expanded ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-2.5 mb-1.5 rounded-[8px] bg-row-hover/60"
            exit={{
              opacity: 0,
              transition: reduced ? instant : fadeOut,
              y: -4,
            }}
            initial={reduced ? false : { opacity: 0, y: -4 }}
            key="sql"
            layout
            transition={reduced ? instant : soft}
          >
            <SqlBlock
              label={`SQL for ${widget.name}`}
              sql={widget.sqlTemplate}
              state="settled"
            />
            {optionQueries(widget.params).map(({ label, sql }) => (
              <div className="border-t border-panel-border" key={label}>
                <p className="px-3 pt-2 type-micro text-panel-muted">
                  {label} options
                </p>
                <SqlBlock
                  label={`${label} options for ${widget.name}`}
                  sql={sql}
                  state="settled"
                />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
