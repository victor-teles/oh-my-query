import type { QueryLanguage } from "@conch/core/client";
import type { CardResult } from "@conch/rpc";

import { MAX_ASK_TURNS } from "@conch/rpc";

import type { CardViewKind } from "@/lib/card-data";
import type {
  AskErrorCode,
  AskEvent,
  AskPhase,
  CardSpec,
  SqlAssumptions,
} from "@/lib/ipc";

import { viewKindOf } from "@/lib/card-data";

export type AskStatus =
  | "idle"
  | "schema"
  | "sql"
  | "run"
  | "present"
  | "done"
  | "error"
  | "cancelled";

export type AskSource = "question" | "sql" | "match";

export type AskTransition = "fresh" | "refine" | "step" | "restore";

export interface AskFailure {
  code: AskErrorCode;
  message: string;
  phase: AskPhase;
}

export interface AskAnswer {
  result: CardResult & { executionTimeMs: number };
  spec: CardSpec | null;
}

export interface AskTurn {
  prompt: string;
  sql: string;
  dialect: QueryLanguage | null;
  answer: AskAnswer & { spec: CardSpec };
  view: CardViewKind;
  assumptions: SqlAssumptions | null;
}

// The live fields describe the ask in flight (or the last one). Once a turn
// completes they mirror the shown turn; while a refine runs the shown turn
// stays on screen and the live fields stream the next one.
export interface AskState {
  status: AskStatus;
  source: AskSource;
  prompt: string;
  phase: AskPhase | null;
  schemaDetail: string | null;
  sql: string;
  sqlComplete: boolean;
  dialect: QueryLanguage | null;
  repairs: number;
  repairReason: string | null;
  answer: AskAnswer | null;
  view: CardViewKind | null;
  sqlExpanded: boolean;
  sqlToggled: boolean;
  failure: AskFailure | null;
  assumptions: SqlAssumptions | null;
  chainId: string | null;
  turns: AskTurn[];
  position: number;
  transition: AskTransition;
}

export type AskAction =
  | AskEvent
  | { type: "start"; prompt: string; source: AskSource; askId: string }
  | { type: "refine"; prompt: string }
  | { type: "stepTurn"; to: number }
  | { type: "restore" }
  | { type: "assumptions"; sql: string; value: SqlAssumptions | null }
  | { type: "cancel" }
  | { type: "selectView"; view: CardViewKind }
  | { type: "toggleSql" };

export const initialAskState: AskState = {
  answer: null,
  assumptions: null,
  chainId: null,
  dialect: null,
  failure: null,
  phase: null,
  position: -1,
  prompt: "",
  repairReason: null,
  repairs: 0,
  schemaDetail: null,
  source: "question",
  sql: "",
  sqlComplete: false,
  sqlExpanded: true,
  sqlToggled: false,
  status: "idle",
  transition: "fresh",
  turns: [],
  view: null,
};

const WORKING: ReadonlySet<AskStatus> = new Set([
  "schema",
  "sql",
  "run",
  "present",
]);

export const isWorking = (status: AskStatus): boolean => WORKING.has(status);

export const lineCount = (sql: string): number =>
  sql ? sql.trimEnd().split("\n").length : 0;

export const shownTurn = (state: AskState): AskTurn | null =>
  state.turns[state.position] ?? null;

export const isRefining = (state: AskState): boolean =>
  isWorking(state.status) && state.turns.length > 0;

const showTurn = (state: AskState, position: number): AskState => {
  const turn = state.turns[position];
  if (!turn) {
    return state;
  }
  return {
    ...state,
    answer: turn.answer,
    assumptions: turn.assumptions,
    dialect: turn.dialect,
    failure: null,
    position,
    prompt: turn.prompt,
    repairReason: null,
    repairs: 0,
    sql: turn.sql,
    sqlComplete: true,
    status: "done",
    view: turn.view,
  };
};

// A refine that comes back with the same kind of card keeps the view the
// user had switched the previous turn to.
const viewForTurn = (state: AskState, spec: CardSpec): CardViewKind => {
  const suggested = viewKindOf(spec.view);
  const base = shownTurn(state);
  return base && viewKindOf(base.answer.spec.view) === suggested
    ? base.view
    : suggested;
};

const completeTurn = (state: AskState, spec: CardSpec): AskState => {
  if (!state.answer) {
    return state;
  }
  const turn: AskTurn = {
    answer: { ...state.answer, spec },
    assumptions: state.assumptions,
    dialect: state.dialect,
    prompt: state.prompt,
    sql: state.sql,
    view: viewForTurn(state, spec),
  };
  const turns = [...state.turns, turn];
  return {
    ...state,
    answer: turn.answer,
    position: turns.length - 1,
    transition: state.turns.length > 0 ? "refine" : "fresh",
    turns,
    view: turn.view,
  };
};

const stopped = (state: AskState): AskState =>
  isRefining(state)
    ? showTurn(state, state.position)
    : { ...state, status: "cancelled" };

const applyEvent = (state: AskState, event: AskEvent): AskState => {
  switch (event.type) {
    case "phase": {
      return {
        ...state,
        phase: event.phase,
        schemaDetail:
          event.phase === "schema" ? event.detail : state.schemaDetail,
        status: event.phase,
      };
    }
    case "sqlDelta": {
      return { ...state, sql: state.sql + event.text };
    }
    case "sqlReset": {
      return {
        ...state,
        assumptions: null,
        repairReason: event.reason,
        repairs: state.repairs + 1,
        sql: "",
        sqlComplete: false,
      };
    }
    case "sqlDone": {
      return {
        ...state,
        dialect: event.dialect,
        sql: event.sql,
        sqlComplete: true,
      };
    }
    case "result": {
      const { type: _type, ...result } = event;
      return {
        ...state,
        answer: { result, spec: null },
        sqlExpanded: state.sqlToggled ? state.sqlExpanded : false,
      };
    }
    case "card": {
      return completeTurn(state, event.spec);
    }
    case "error": {
      if (event.code === "CANCELLED") {
        return stopped(state);
      }
      return {
        ...state,
        failure: {
          code: event.code,
          message: event.message,
          phase: event.phase,
        },
        sql: event.sql ?? state.sql,
        sqlExpanded: true,
        status: "error",
      };
    }
    case "done": {
      return { ...state, status: "done" };
    }
    default: {
      return state;
    }
  }
};

export const canRefine = (state: AskState): boolean =>
  !isWorking(state.status) &&
  state.source === "question" &&
  shownTurn(state) !== null &&
  state.position + 1 < MAX_ASK_TURNS;

export const atTurnLimit = (state: AskState): boolean =>
  state.source === "question" &&
  shownTurn(state) !== null &&
  state.position + 1 >= MAX_ASK_TURNS;

const refine = (state: AskState, prompt: string): AskState => {
  if (!canRefine(state)) {
    return state;
  }
  return {
    ...state,
    answer: null,
    assumptions: null,
    dialect: null,
    failure: null,
    phase: null,
    prompt,
    repairReason: null,
    repairs: 0,
    schemaDetail: null,
    sql: "",
    sqlComplete: false,
    status: "schema",
    turns: state.turns.slice(0, state.position + 1),
    view: null,
  };
};

const withAssumptions = (
  state: AskState,
  sql: string,
  value: SqlAssumptions | null
): AskState => {
  const matchesTurn = state.turns.some((turn) => turn.sql === sql);
  if (state.sql !== sql && !matchesTurn) {
    return state;
  }
  return {
    ...state,
    assumptions: state.sql === sql ? value : state.assumptions,
    turns: matchesTurn
      ? state.turns.map((turn) =>
          turn.sql === sql ? { ...turn, assumptions: value } : turn
        )
      : state.turns,
  };
};

const selectView = (state: AskState, view: CardViewKind): AskState => {
  const turn = shownTurn(state);
  if (!turn) {
    return state;
  }
  return {
    ...state,
    turns: state.turns.map((item, index) =>
      index === state.position ? { ...item, view } : item
    ),
    view: isWorking(state.status) ? state.view : view,
  };
};

export const askReducer = (state: AskState, action: AskAction): AskState => {
  switch (action.type) {
    case "start": {
      const runsSql = action.source !== "question";
      return {
        ...initialAskState,
        chainId: action.askId,
        phase: runsSql ? "run" : null,
        prompt: action.prompt,
        source: action.source,
        status: runsSql ? "run" : "schema",
      };
    }
    case "refine": {
      return refine(state, action.prompt);
    }
    case "stepTurn": {
      if (isWorking(state.status) || !state.turns[action.to]) {
        return state;
      }
      return { ...showTurn(state, action.to), transition: "step" };
    }
    case "restore": {
      return state.turns.length > 0
        ? { ...state, transition: "restore" }
        : state;
    }
    case "assumptions": {
      return withAssumptions(state, action.sql, action.value);
    }
    case "cancel": {
      return isWorking(state.status) ? stopped(state) : state;
    }
    case "selectView": {
      return selectView(state, action.view);
    }
    case "toggleSql": {
      if (!state.sql) {
        return state;
      }
      return { ...state, sqlExpanded: !state.sqlExpanded, sqlToggled: true };
    }
    default: {
      return isWorking(state.status) ? applyEvent(state, action) : state;
    }
  }
};
