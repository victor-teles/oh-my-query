import type { DatabaseType } from "@/lib/connections";

const COMMENT_LINE = /--.*$/gm;
const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;
const STRING_SINGLE = /'(?:''|[^'])*'/g;
const STRING_DOLLAR = /\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g;

const UNCONDITIONAL = /\b(drop|truncate|alter)\b/i;
const DELETE_KEYWORD = /\bdelete\b/i;
const UPDATE_KEYWORD = /\bupdate\b/i;
const WHERE_CLAUSE = /\bwhere\b/i;

export type DestructiveKind =
  | "drop"
  | "truncate"
  | "alter"
  | "delete"
  | "update";

export interface DestructiveClassification {
  kind: DestructiveKind;
  keyword: string;
  reason: string;
}

export const normalizeSqlForAnalysis = (sql: string): string =>
  sql
    .replace(COMMENT_BLOCK, " ")
    .replace(COMMENT_LINE, " ")
    .replace(STRING_DOLLAR, " ")
    .replace(STRING_SINGLE, " ");

const classifyUnconditional = (
  normalized: string
): DestructiveClassification | null => {
  const match = UNCONDITIONAL.exec(normalized);
  if (!match?.[1]) {
    return null;
  }
  const keyword = match[1].toLowerCase() as "drop" | "truncate" | "alter";
  if (keyword === "drop") {
    return {
      keyword: "DROP",
      kind: "drop",
      reason: "Permanently removes a database object.",
    };
  }
  if (keyword === "truncate") {
    return {
      keyword: "TRUNCATE",
      kind: "truncate",
      reason: "Removes every row in the table.",
    };
  }
  return {
    keyword: "ALTER",
    kind: "alter",
    reason: "Modifies schema — can be irreversible.",
  };
};

const classifyUnscopedMutation = (
  normalized: string
): DestructiveClassification | null => {
  const deleteMatch = DELETE_KEYWORD.exec(normalized);
  if (deleteMatch) {
    const afterDelete = normalized.slice(
      deleteMatch.index + deleteMatch[0].length
    );
    if (!WHERE_CLAUSE.test(afterDelete)) {
      return {
        keyword: "DELETE",
        kind: "delete",
        reason: "No WHERE clause — deletes every row in the table.",
      };
    }
  }

  const updateMatch = UPDATE_KEYWORD.exec(normalized);
  if (updateMatch) {
    const afterUpdate = normalized.slice(
      updateMatch.index + updateMatch[0].length
    );
    if (!WHERE_CLAUSE.test(afterUpdate)) {
      return {
        keyword: "UPDATE",
        kind: "update",
        reason: "No WHERE clause — updates every row in the table.",
      };
    }
  }

  return null;
};

interface DialectRule {
  pattern: RegExp;
  result: DestructiveClassification;
}

const MONGO_RULES: DialectRule[] = [
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
    pattern: /\.drop\s*\(\s*\)/i,
    result: {
      keyword: "drop",
      kind: "drop",
      reason: "Permanently drops the collection.",
    },
  },
  {
    pattern: /\.deleteMany\s*\(\s*\{?\s*\}?\s*\)/i,
    result: {
      keyword: "deleteMany",
      kind: "delete",
      reason: "Empty filter — deletes every document in the collection.",
    },
  },
  {
    pattern: /\.deleteOne\s*\(\s*\{?\s*\}?\s*\)/i,
    result: {
      keyword: "deleteOne",
      kind: "delete",
      reason: "Empty filter — deletes the first document in the collection.",
    },
  },
  {
    pattern: /\.remove\s*\(\s*\{?\s*\}?\s*\)/i,
    result: {
      keyword: "remove",
      kind: "delete",
      reason: "Empty filter — removes every document in the collection.",
    },
  },
];

const REDIS_RULES: DialectRule[] = [
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
    pattern: /^\s*del\s+\*/im,
    result: {
      keyword: "DEL *",
      kind: "delete",
      reason: "Glob pattern — may delete all keys.",
    },
  },
];

const matchRule = (
  raw: string,
  rules: DialectRule[]
): DestructiveClassification | null =>
  rules.find((rule) => rule.pattern.test(raw))?.result ?? null;

export const classifyDestructiveSql = (
  rawSql: string,
  dialect?: DatabaseType
): DestructiveClassification | null => {
  if (dialect === "mongodb") {
    return matchRule(rawSql, MONGO_RULES);
  }
  if (dialect === "redis") {
    return matchRule(rawSql, REDIS_RULES);
  }
  const normalized = normalizeSqlForAnalysis(rawSql);
  return (
    classifyUnconditional(normalized) ?? classifyUnscopedMutation(normalized)
  );
};
