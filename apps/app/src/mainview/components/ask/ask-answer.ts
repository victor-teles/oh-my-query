import { isSqlDialect } from "@oh-my-query/core/client";

import type { ExportSource } from "@/components/result-actions/use-result-export";
import type { AnsweredAsk } from "@/components/widgets/widget-draft";
import type { CardViewKind } from "@/lib/card-data";

import { alternatesFor } from "@/lib/card-data";

import type { AskState, AskTurn } from "./ask-reducer";

import { chainPromptOf } from "./ask-chain";
import { shownTurn } from "./ask-reducer";

export const viewsOf = (state: AskState): CardViewKind[] => {
  const turn = shownTurn(state);
  return turn
    ? alternatesFor(turn.answer.spec, turn.answer.result).map(
        (option) => option.kind
      )
    : [];
};

export const answeredOf = (
  state: AskState,
  connectionId: string | undefined
): AnsweredAsk | null => {
  const turn = shownTurn(state);
  const dialect = turn?.dialect;
  // Match SQL carries a native bind marker, which a widget template can't hold.
  if (
    state.source === "match" ||
    !(turn && dialect && isSqlDialect(dialect) && connectionId)
  ) {
    return null;
  }
  return {
    connectionId,
    dialect,
    prompt: state.source === "sql" ? "" : chainPromptOf(state),
    spec: turn.answer.spec,
    sql: turn.sql,
    view: turn.view,
  };
};

// Widgets bind template values as SQL parameters, so only SQL answers save.
export const saveUnavailableOf = (state: AskState): boolean => {
  const dialect = shownTurn(state)?.dialect;
  return dialect !== undefined && dialect !== null && !isSqlDialect(dialect);
};

export const exportSourceOf = (turn: AskTurn | null): ExportSource | null =>
  turn
    ? { result: turn.answer.result, spec: turn.answer.spec, view: turn.view }
    : null;
