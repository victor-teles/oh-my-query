import type {
  DestructiveClassifier,
  DestructiveRule,
} from "@oh-my-query/core/client";

import { matchRule } from "@oh-my-query/core/client";

const RULES: DestructiveRule[] = [
  {
    pattern: /\.dropDatabase\s*\(/i,
    result: {
      keyword: "dropDatabase",
      kind: "drop",
      reason: "Permanently drops the entire database.",
    },
  },
  {
    pattern: /\.dropCollection\s*\(/i,
    result: {
      keyword: "drop",
      kind: "drop",
      reason: "Permanently drops the collection.",
    },
  },
  {
    pattern: /\.drop\s*\(/i,
    result: {
      keyword: "drop",
      kind: "drop",
      reason: "Permanently drops the collection.",
    },
  },
  {
    pattern: /\.deleteMany\s*\(\s*(?:\{\s*\})?\s*[,)]/i,
    result: {
      keyword: "deleteMany",
      kind: "delete",
      reason: "Empty filter — deletes every document in the collection.",
    },
  },
  {
    pattern: /\.deleteOne\s*\(\s*(?:\{\s*\})?\s*[,)]/i,
    result: {
      keyword: "deleteOne",
      kind: "delete",
      reason: "Empty filter — deletes the first document in the collection.",
    },
  },
  {
    pattern: /\.remove\s*\(\s*(?:\{\s*\})?\s*[,)]/i,
    result: {
      keyword: "remove",
      kind: "delete",
      reason: "Empty filter — removes every document in the collection.",
    },
  },
];

export const classifyDestructive: DestructiveClassifier = (rawSql) =>
  matchRule(rawSql, RULES);
