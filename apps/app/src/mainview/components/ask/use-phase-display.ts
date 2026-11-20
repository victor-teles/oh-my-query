import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { AskState } from "./ask-reducer";

import { isRefining, isWorking, shownTurn } from "./ask-reducer";

export type AskBody =
  | "empty"
  | "working"
  | "card"
  | "refining"
  | "refine-error"
  | "error"
  | "stopped";

// The working state shows only after 150ms and then holds for 300ms, so a
// fast answer swaps straight to the card and a slow one never flickers. A
// refine keeps the shown card on screen instead of a skeleton.
export const usePhaseDisplay = (state: AskState): AskBody => {
  const refining = isRefining(state);
  const working = useDelayedVisibility(isWorking(state.status) && !refining);
  const hasTurn = shownTurn(state) !== null;
  if (refining) {
    return "refining";
  }
  if (working) {
    return "working";
  }
  if (state.status === "error") {
    return hasTurn ? "refine-error" : "error";
  }
  if (state.status === "cancelled") {
    return "stopped";
  }
  return hasTurn ? "card" : "empty";
};

const CARD_BODIES: ReadonlySet<AskBody> = new Set([
  "card",
  "refining",
  "refine-error",
]);

// Every body that shows the answer card shares one key, so the card element
// survives a refine instead of re-entering.
export const bodyKeyOf = (body: AskBody): string =>
  CARD_BODIES.has(body) ? "card" : body;
