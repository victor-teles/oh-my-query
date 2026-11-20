import { chainPrompt } from "@conch/rpc";

import type { RefineContext } from "@/lib/ipc";

import type { AskState } from "./ask-reducer";

import { shownTurn } from "./ask-reducer";

const promptsUpTo = (state: AskState): string[] =>
  state.turns.slice(0, state.position + 1).map((turn) => turn.prompt);

export const chainPromptOf = (state: AskState): string => {
  const prompts = promptsUpTo(state);
  return chainPrompt(prompts.slice(0, -1), prompts.at(-1) ?? "");
};

// Only the turns up to the one on screen travel as context; later branches
// the user stepped back from are never sent.
export const refineContextOf = (state: AskState): RefineContext | null => {
  const turn = shownTurn(state);
  if (!(turn && state.chainId)) {
    return null;
  }
  return {
    chainId: state.chainId,
    spec: turn.answer.spec,
    sql: turn.sql,
    turns: promptsUpTo(state),
  };
};
