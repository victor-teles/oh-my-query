import type {
  DestructiveClassifier,
  DestructiveRule,
} from "@oh-my-query/core/client";

import { matchRule } from "@oh-my-query/core/client";

const RULES: DestructiveRule[] = [
  {
    pattern: /^\s*flushall\b/im,
    result: {
      keyword: "FLUSHALL",
      kind: "drop",
      reason: "Deletes all keys across every Redis database.",
    },
  },
  {
    pattern: /^\s*flushdb\b/im,
    result: {
      keyword: "FLUSHDB",
      kind: "drop",
      reason: "Deletes all keys in the current Redis database.",
    },
  },
  {
    pattern: /^\s*del\s+\*(?:\s|$)/im,
    result: {
      keyword: "DEL *",
      kind: "delete",
      reason: "Glob pattern — may delete all keys.",
    },
  },
];

export const classifyDestructive: DestructiveClassifier = (rawSql) =>
  matchRule(rawSql, RULES);
