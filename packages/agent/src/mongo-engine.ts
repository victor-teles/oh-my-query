import {
  MONGO_READ_STAGES,
  parseMongoReadQuery,
} from "@oh-my-query/core/client";

import type { QueryEngine } from "./query-engine.ts";

import {
  MONGO_REPLY,
  mongoSystemPrompt,
  refineInstructionFor,
  repairInstructionFor,
} from "./prompts.ts";
import { verdictOf } from "./query-engine.ts";
import { formatMongoSchema } from "./schema-prompt.ts";

export const mongoEngine: QueryEngine = {
  formatSchema: formatMongoSchema,
  guard: (text) => verdictOf(parseMongoReadQuery(text)),
  label: "MongoDB",
  language: "mongodb",
  refineInstruction: refineInstructionFor(MONGO_REPLY),
  repairInstruction: repairInstructionFor(MONGO_REPLY),
  systemPrompt: (input) => mongoSystemPrompt(input, MONGO_READ_STAGES),
  writingDetail: "Writing the pipeline",
};
