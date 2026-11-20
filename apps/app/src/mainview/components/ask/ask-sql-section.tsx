import { AnimatePresence, motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";
import { changedLines } from "@/lib/sql-diff";

import type { AskState } from "./ask-reducer";
import type { QueryKind } from "./query-kind";
import type { SqlBlockState } from "./sql-block";

import { offendingKeyword } from "./ask-error";
import { AskHeader } from "./ask-header";
import { indicatorFor, sqlHeading } from "./ask-labels";
import { isRefining, isWorking, shownTurn } from "./ask-reducer";
import { CopySqlButton } from "./copy-sql-button";
import { SqlBlock } from "./sql-block";
import { SqlToggleButton } from "./sql-toggle-button";

interface ShownSql {
  key: string;
  sql: string;
  state: SqlBlockState;
  changed: ReadonlySet<number>;
}

const NOTHING_CHANGED: ReadonlySet<number> = new Set();

// While a refine waits for its first token the previous SQL stays, dimmed,
// then crossfades to the new stream; a settled later turn marks what changed.
const shownSqlOf = (state: AskState): ShownSql => {
  const base = shownTurn(state);
  if (isRefining(state) && state.sql === "" && base) {
    return {
      changed: NOTHING_CHANGED,
      key: `sql-${state.position}`,
      sql: base.sql,
      state: "stopped",
    };
  }
  const turn = isRefining(state) ? state.position + 1 : state.position;
  const previous = state.turns[state.position - 1];
  const settled = !isWorking(state.status) && state.status !== "error";
  return {
    changed:
      settled && previous && base
        ? changedLines(previous.sql, base.sql)
        : NOTHING_CHANGED,
    key: `sql-${turn}-${state.repairs}`,
    sql: state.sql,
    state: blockStateOf(state),
  };
};

export const blockStateOf = (state: AskState): SqlBlockState => {
  if (state.status === "cancelled") {
    return "stopped";
  }
  return isWorking(state.status) && !state.sqlComplete
    ? "streaming"
    : "settled";
};

interface AskSqlSectionProps {
  state: AskState;
  kind: QueryKind;
  segments: readonly string[];
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
}

export function AskSqlSection({
  state,
  kind,
  segments,
  copied,
  onCopy,
  onToggle,
}: AskSqlSectionProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  const shown = shownSqlOf(state);
  const visible = state.sqlExpanded && shown.sql !== "";

  return (
    <>
      <AskHeader
        heading={sqlHeading(state.source, kind)}
        indicator={indicatorFor(state)}
        segments={segments}
      >
        <CopySqlButton copied={copied} disabled={!state.sql} onCopy={onCopy} />
        <SqlToggleButton
          disabled={!shown.sql}
          expanded={visible}
          onToggle={onToggle}
        />
      </AskHeader>
      <AnimatePresence initial={false} mode="popLayout">
        {visible ? (
          <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: [0.4, 0], transition: fadeOut }}
            initial={{ opacity: 0 }}
            key={shown.key}
            transition={fadeIn}
          >
            <SqlBlock
              changed={shown.changed}
              kind={kind}
              mark={state.failure ? offendingKeyword(state.failure) : null}
              sql={shown.sql}
              state={shown.state}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
