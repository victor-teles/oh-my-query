import type { FooterHint } from "@/components/launcher/launcher-footer";

import type { AskState } from "./ask-reducer";

import { shownTurn } from "./ask-reducer";

const STOP: FooterHint = { keys: ["esc"], label: "Stop" };
const ACTIONS: FooterHint = { keys: ["⌘", "K"], label: "Actions" };
const COPY: FooterHint = { keys: ["⌘", "C"], label: "Copy SQL" };
const TOGGLE: FooterHint = { keys: ["⌘", "E"], label: "SQL" };
const SAVE: FooterHint = { keys: ["⌘", "S"], label: "Save" };
const NEW: FooterHint = { keys: ["⌘", "↩"], label: "New question" };
const STEPS: FooterHint = { keys: ["↑", "↓"], label: "Steps" };

interface AskFooterState {
  busy: boolean;
  canSave: boolean;
  hasSql: boolean;
  reporting: boolean;
  chain: { turns: number } | null;
}

// A result message ("Saved …csv · Show in Finder") needs the footer's width
// more than the shortcut hints do while it is showing.
// A refinable answer trades the Copy and SQL hints (both in ⌘K) for the
// chain's own keys, so the footer keeps its width.
export const askFooterHints = ({
  busy,
  canSave,
  hasSql,
  reporting,
  chain,
}: AskFooterState): FooterHint[] => {
  if (busy) {
    return [STOP];
  }
  if (reporting) {
    return [ACTIONS];
  }
  if (chain) {
    const steps = chain.turns > 1 ? [STEPS] : [];
    return [NEW, ...steps, ACTIONS, ...(canSave ? [SAVE] : [])];
  }
  if (!canSave) {
    return hasSql ? [ACTIONS, COPY, TOGGLE] : [COPY, TOGGLE];
  }
  return [ACTIONS, SAVE, COPY, TOGGLE];
};

export const chainHintOf = (state: AskState): AskFooterState["chain"] =>
  shownTurn(state) && state.source === "question"
    ? { turns: state.turns.length }
    : null;
