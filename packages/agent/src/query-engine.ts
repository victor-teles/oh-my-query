import type { QueryLanguage, SchemaInfo } from "@oh-my-query/core";

import type { EnginePromptInput, PreviousAnswer } from "./prompts.ts";
import type { ReadOnlyVerdict } from "./read-only-guard.ts";
import type { SchemaPromptOptions } from "./schema-prompt.ts";

export interface QueryEngine {
  language: QueryLanguage;
  label: string;
  writingDetail: string;
  systemPrompt(input: EnginePromptInput): string;
  repairInstruction(error: string): string;
  refineInstruction(followUp: string, previous: PreviousAnswer): string;
  formatSchema(schema: SchemaInfo, options: SchemaPromptOptions): string;
  guard(text: string): ReadOnlyVerdict;
}

export const verdictOf = (
  parsed: { ok: true } | { ok: false; reason: string }
): ReadOnlyVerdict =>
  parsed.ok ? { ok: true } : { ok: false, reason: parsed.reason };
