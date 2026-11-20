import type { AskState } from "./ask-reducer";

import { isRefining } from "./ask-reducer";

export type TrailCrumb =
  | { kind: "turn"; index: number; prompt: string; pending: boolean }
  | { kind: "gap"; hidden: string[] };

const MAX_VISIBLE = 4;

const visibleIndexes = (count: number, position: number): Set<number> =>
  count <= MAX_VISIBLE
    ? new Set(Array.from({ length: count }, (_, index) => index))
    : new Set([0, position, count - 2, count - 1]);

// Long chains keep the first crumb, the shown one and the last two; the
// rest fold into one "…" crumb that lists them in its tooltip.
export const trailCrumbs = (
  prompts: readonly string[],
  position: number,
  pending: string | null
): TrailCrumb[] => {
  const all = pending === null ? prompts : [...prompts, pending];
  const visible = visibleIndexes(all.length, position);
  const crumbs: TrailCrumb[] = [];
  for (const [index, prompt] of all.entries()) {
    if (visible.has(index)) {
      crumbs.push({
        index,
        kind: "turn",
        pending: pending !== null && index === all.length - 1,
        prompt,
      });
      continue;
    }
    const last = crumbs.at(-1);
    if (last?.kind === "gap") {
      last.hidden.push(prompt);
    } else {
      crumbs.push({ hidden: [prompt], kind: "gap" });
    }
  }
  return crumbs;
};

export const trailOf = (state: AskState): TrailCrumb[] => {
  const refining = isRefining(state);
  if (state.turns.length < 2 && !refining) {
    return [];
  }
  return trailCrumbs(
    state.turns.map((turn) => turn.prompt),
    state.position,
    refining ? state.prompt : null
  );
};
