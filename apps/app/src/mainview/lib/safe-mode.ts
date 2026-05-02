import type { DatabaseType } from "@/lib/connections";

const COMMENT_LINE = /--.*$/gm;
const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;
const STRING_SINGLE = /'(?:''|[^'])*'/g;
const STRING_DOLLAR = /\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g;

const UNCONDITIONAL = /\b(drop|truncate|alter)\b/i;
const DELETE_KEYWORD = /\bdelete\b/i;
const UPDATE_KEYWORD = /\bupdate\b/i;
const WHERE_CLAUSE = /\bwhere\b/i;

// MongoDB destructive patterns
const MONGO_DELETE_MANY_EMPTY = /\.deleteMany\s*\(\s*\{?\s*\}?\s*\)/i;
const MONGO_DELETE_ONE_EMPTY = /\.deleteOne\s*\(\s*\{?\s*\}?\s*\)/i;
const MONGO_REMOVE_EMPTY = /\.remove\s*\(\s*\{?\s*\}?\s*\)/i;
const MONGO_DROP = /\.drop\s*\(\s*\)/i;
const MONGO_DROP_COLLECTION = /\.dropCollection\s*\(/i;
const MONGO_DROP_DATABASE = /\.dropDatabase\s*\(/i;

// Redis destructive patterns
const REDIS_FLUSHDB = /^\s*flushdb\b/im;
const REDIS_FLUSHALL = /^\s*flushall\b/im;
const REDIS_DEL_GLOB = /^\s*del\s+\*/im;

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

const classifyMongoDB = (raw: string): DestructiveClassification | null => {
  if (MONGO_DROP_DATABASE.test(raw)) {
    return {
      keyword: "dropDatabase",
      kind: "drop",
      reason: "Permanently drops the entire database.",
    };
  }
  if (MONGO_DROP_COLLECTION.test(raw) || MONGO_DROP.test(raw)) {
    return {
      keyword: "drop",
      kind: "drop",
      reason: "Permanently drops the collection.",
    };
  }
  if (MONGO_DELETE_MANY_EMPTY.test(raw)) {
    return {
      keyword: "deleteMany",
      kind: "delete",
      reason: "Empty filter — deletes every document in the collection.",
    };
  }
  if (MONGO_DELETE_ONE_EMPTY.test(raw)) {
    return {
      keyword: "deleteOne",
      kind: "delete",
      reason: "Empty filter — deletes the first document in the collection.",
    };
  }
  if (MONGO_REMOVE_EMPTY.test(raw)) {
    return {
      keyword: "remove",
      kind: "delete",
      reason: "Empty filter — removes every document in the collection.",
    };
  }
  return null;
};

const classifyRedis = (raw: string): DestructiveClassification | null => {
  if (REDIS_FLUSHALL.test(raw)) {
    return {
      keyword: "FLUSHALL",
      kind: "drop",
      reason: "Deletes all keys across every Redis database.",
    };
  }
  if (REDIS_FLUSHDB.test(raw)) {
    return {
      keyword: "FLUSHDB",
      kind: "drop",
      reason: "Deletes all keys in the current Redis database.",
    };
  }
  if (REDIS_DEL_GLOB.test(raw)) {
    return {
      keyword: "DEL *",
      kind: "delete",
      reason: "Glob pattern — may delete all keys.",
    };
  }
  return null;
};

export const classifyDestructiveSql = (
  rawSql: string,
  dialect?: DatabaseType
): DestructiveClassification | null => {
  if (dialect === "mongodb") {
    return classifyMongoDB(rawSql);
  }
  if (dialect === "redis") {
    return classifyRedis(rawSql);
  }
  const normalized = normalizeSqlForAnalysis(rawSql);
  return (
    classifyUnconditional(normalized) ?? classifyUnscopedMutation(normalized)
  );
};
