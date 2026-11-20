import { z } from "zod";

import { CardSpec } from "./card-spec.ts";

export const MAX_ASK_TURNS = 6;
export const MAX_REFINE_SQL = 20_000;
const MAX_TURN_PROMPT = 4000;

export const RefineContext = z.object({
  chainId: z.string().min(1).max(100),
  spec: CardSpec,
  sql: z.string().min(1).max(MAX_REFINE_SQL),
  turns: z
    .array(z.string().trim().min(1).max(MAX_TURN_PROMPT))
    .min(1)
    .max(MAX_ASK_TURNS - 1),
});
export type RefineContext = z.infer<typeof RefineContext>;

const CHAIN_SEPARATOR = " · ";

export const chainPrompt = (turns: readonly string[], prompt: string): string =>
  [...turns, prompt]
    .map((turn) => turn.trim())
    .filter((turn) => turn !== "")
    .join(CHAIN_SEPARATOR);
