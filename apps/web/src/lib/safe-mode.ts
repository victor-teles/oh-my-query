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

export const classifyDestructiveSql = (
  rawSql: string
): DestructiveClassification | null => {
  const normalized = normalizeSqlForAnalysis(rawSql);
  return (
    classifyUnconditional(normalized) ?? classifyUnscopedMutation(normalized)
  );
};
