import { parseRedisReadPlan, REDIS_READ_COMMANDS } from "@conch/core/client";

import type { QueryEngine } from "./query-engine.ts";

import {
  REDIS_REPLY,
  redisSystemPrompt,
  refineInstructionFor,
  repairInstructionFor,
} from "./prompts.ts";
import { verdictOf } from "./query-engine.ts";
import { formatRedisSchema } from "./schema-prompt.ts";

const PROMPT_COMMANDS = REDIS_READ_COMMANDS.map((name) =>
  name === "MEMORY" ? "MEMORY USAGE" : name
);

export const redisEngine: QueryEngine = {
  formatSchema: formatRedisSchema,
  guard: (text) => verdictOf(parseRedisReadPlan(text)),
  label: "Redis",
  language: "redis",
  refineInstruction: refineInstructionFor(REDIS_REPLY),
  repairInstruction: repairInstructionFor(REDIS_REPLY),
  systemPrompt: (input) => redisSystemPrompt(input, PROMPT_COMMANDS),
  writingDetail: "Writing the commands",
};
