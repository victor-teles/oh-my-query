import { vi } from "vitest";

import type { AskState, AskTurn } from "@/components/ask/ask-reducer";
import type { AskSession } from "@/components/ask/use-ask";
import type { AskEvent } from "@/lib/ipc";

import { refineContextOf } from "@/components/ask/ask-chain";
import { askReducer, initialAskState } from "@/components/ask/ask-reducer";
import { askScriptFor, rawScriptFor, scriptFor } from "@/lib/browser-ask-stub";
import { recordedAssumptions } from "@/lib/browser-refine-stub";

type EventType = AskEvent["type"];

const replayInto = (
  from: AskState,
  steps: [number, AskEvent][],
  stopAfter?: { type: EventType; nth?: number }
): AskState => {
  let state = from;
  let seen = 0;
  for (const [, event] of steps) {
    state = askReducer(state, event);
    if (event.type === stopAfter?.type) {
      seen += 1;
      if (seen === (stopAfter.nth ?? 1)) {
        break;
      }
    }
  }
  return state;
};

// Replays the recorded browser-stub ask through the real reducer, stopping
// after the nth event of the given type (or at the end).
export const askStateAfter = (
  prompt: string,
  stopAfter?: { type: EventType; nth?: number }
): AskState => {
  const state = askReducer(initialAskState, {
    askId: "ask-1",
    prompt,
    source: "question",
    type: "start",
  });
  return replayInto(state, scriptFor(prompt, "analytics"), stopAfter);
};

// Replays a recorded refine of the shown turn, like askStateAfter.
export const refineStateAfter = (
  from: AskState,
  prompt: string,
  stopAfter?: { type: EventType; nth?: number }
): AskState => {
  const params = {
    askId: "refine",
    connectionId: "analytics",
    database: null,
    prompt,
    refine: refineContextOf(from) ?? undefined,
  };
  const state = askReducer(from, { prompt, type: "refine" });
  return replayInto(state, askScriptFor(params, "analytics"), stopAfter);
};

// Applies the recorded assumptions to every turn, as describeSql would.
export const withRecordedAssumptions = (from: AskState): AskState => {
  let state = from;
  for (const turn of from.turns) {
    state = askReducer(state, {
      sql: turn.sql,
      type: "assumptions",
      value: recordedAssumptions(turn.sql),
    });
  }
  return state;
};

export const REVENUE = "Revenue by region";
export const SIGNUPS = "Weekly signups by plan";
export const REFUSED = "delete all users";

export const fakeSession = (
  state: AskState,
  overrides: Partial<Omit<AskSession, "state">> = {}
): AskSession => ({
  cancel: vi.fn(),
  refine: vi.fn<AskSession["refine"]>().mockResolvedValue(),
  restore: vi.fn(),
  selectView: vi.fn(),
  start: vi.fn<AskSession["start"]>().mockResolvedValue(),
  startMatch: vi.fn<AskSession["startMatch"]>().mockResolvedValue(),
  startSql: vi.fn<AskSession["startSql"]>().mockResolvedValue(),
  state,
  stepTurn: vi.fn(),
  toggleSql: vi.fn(),
  ...overrides,
});

// Replays a recorded raw SQL run (the `>` input) through the real reducer.
export const rawStateAfter = (sql: string, stopAfter?: EventType): AskState => {
  let state = askReducer(initialAskState, {
    askId: "raw",
    prompt: sql,
    source: "sql",
    type: "start",
  });
  const steps = rawScriptFor({
    askId: "raw",
    connectionId: "analytics",
    database: null,
    source: { kind: "sql", sql },
  });
  for (const [, event] of steps) {
    state = askReducer(state, event);
    if (event.type === stopAfter) {
      break;
    }
  }
  return state;
};

// Edits the shown turn of an answered state, keeping the live fields in step.
export const withShownTurn = (
  state: AskState,
  patch: Partial<AskTurn>
): AskState => {
  const turns = state.turns.map((turn, index) =>
    index === state.position ? { ...turn, ...patch } : turn
  );
  const shown = turns[state.position];
  return shown
    ? { ...state, answer: shown.answer, turns, view: shown.view }
    : state;
};
