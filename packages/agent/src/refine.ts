import type { CardSpec, RefineContext } from "@oh-my-query/rpc";
import type { ModelMessage } from "ai";

import type { QueryEngine } from "./query-engine.ts";

const viewLabel = (spec: CardSpec): string =>
  spec.view.kind === "chart" ? `${spec.view.mark} chart` : spec.view.kind;

const conversationOf = (turns: readonly string[]): string => {
  const [first = "", ...later] = turns;
  return [first, ...later.map((turn) => `Then: ${turn}`)].join("\n");
};

export const refineMessages = (
  refine: RefineContext,
  prompt: string,
  engine: Pick<QueryEngine, "refineInstruction">
): ModelMessage[] => [
  { content: conversationOf(refine.turns), role: "user" },
  { content: refine.sql, role: "assistant" },
  {
    content: engine.refineInstruction(prompt, {
      title: refine.spec.title,
      view: viewLabel(refine.spec),
    }),
    role: "user",
  },
];

export const relevanceText = (refine: RefineContext, prompt: string): string =>
  [...refine.turns, prompt, refine.sql].join("\n");
