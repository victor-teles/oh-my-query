import type { DialectType } from "@conch/core";

import type { QueryEngine } from "./query-engine.ts";

import {
  refineInstruction,
  repairInstruction,
  sqlSystemPrompt,
} from "./prompts.ts";
import { assertReadOnly } from "./read-only-guard.ts";
import { DIALECT_LABELS, formatSchemaForPrompt } from "./schema-prompt.ts";

export const sqlEngine = (dialect: DialectType): QueryEngine => ({
  formatSchema: (schema, options) =>
    formatSchemaForPrompt(schema, dialect, options),
  guard: (text) => assertReadOnly(text, dialect),
  label: DIALECT_LABELS[dialect],
  language: dialect,
  refineInstruction,
  repairInstruction,
  systemPrompt: (input) => sqlSystemPrompt({ ...input, dialect }),
  writingDetail: "Writing SQL",
});
