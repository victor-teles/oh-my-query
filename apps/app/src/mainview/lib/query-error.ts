export type ErrorCategory =
  | "syntax"
  | "connection"
  | "timeout"
  | "permission"
  | "constraint"
  | "not-found"
  | "unknown";

interface ErrorClassification {
  category: ErrorCategory;
  label: string;
  summary: string;
  hint: string;
}

const CODE_TO_CATEGORY = new Map<string, ErrorCategory>([
  ["QUERY_TIMEOUT", "timeout"],
  ["IO_ERROR", "connection"],
  ["TLS_ERROR", "connection"],
  ["CONFIG_ERROR", "connection"],
  // PostgreSQL
  ["42601", "syntax"],
  ["42000", "syntax"],
  ["42501", "permission"],
  ["28000", "permission"],
  ["28P01", "permission"],
  ["42P01", "not-found"],
  ["42703", "not-found"],
  ["42883", "not-found"],
  ["3F000", "not-found"],
  ["42P06", "not-found"],
  ["23000", "constraint"],
  ["23001", "constraint"],
  ["23502", "constraint"],
  ["23503", "constraint"],
  ["23505", "constraint"],
  ["23514", "constraint"],
  ["23P01", "constraint"],
  // MySQL (numeric codes stored as strings)
  ["1064", "syntax"],
  ["1149", "syntax"],
  ["1044", "permission"],
  ["1045", "permission"],
  ["1142", "permission"],
  ["1146", "not-found"],
  ["1054", "not-found"],
  ["1305", "not-found"],
  ["1062", "constraint"],
  ["1451", "constraint"],
  ["1452", "constraint"],
  ["1048", "constraint"],
]);

const SKIP_CODES = new Set(["MONGO_ERROR", "REDIS_ERROR", "CLICKHOUSE_ERROR"]);

const classifyByCode = (code: string): ErrorCategory | null => {
  if (SKIP_CODES.has(code)) {
    return null;
  }
  return CODE_TO_CATEGORY.get(code) ?? null;
};

const CONNECTION_PATTERNS = [
  /connection\s+(refused|reset|timed?\s*out|closed)/i,
  /could\s+not\s+connect/i,
  /no\s+connection/i,
  /broken\s+pipe/i,
  /network\s+is\s+unreachable/i,
  /ssl|tls/i,
  /authentication\s+failed/i,
  /password\s+authentication/i,
];

const SYNTAX_PATTERNS = [
  /syntax\s+error/i,
  /unexpected\s+token/i,
  /near\s+"[^"]*"/i,
  /at\s+or\s+near/i,
];

const PERMISSION_PATTERNS = [
  /permission\s+denied/i,
  /access\s+denied/i,
  /insufficient\s+privilege/i,
  /not\s+allowed/i,
];

const NOT_FOUND_PATTERNS = [
  /relation\s+"[^"]*"\s+does\s+not\s+exist/i,
  /table\s+"?[^"]*"?\s+(does\s+not\s+exist|doesn't\s+exist|not\s+found)/i,
  /column\s+"?[^"]*"?\s+(does\s+not\s+exist|not\s+found|unknown)/i,
  /unknown\s+column/i,
  /function\s+"?[^"]*"?\s+does\s+not\s+exist/i,
  /schema\s+"?[^"]*"?\s+does\s+not\s+exist/i,
  /database\s+"?[^"]*"?\s+(does\s+not\s+exist|not\s+found)/i,
];

const CONSTRAINT_PATTERNS = [
  /duplicate\s+key/i,
  /unique\s+constraint/i,
  /foreign\s+key\s+constraint/i,
  /not-null\s+constraint|null\s+value\s+in\s+column/i,
  /violates\s+check\s+constraint/i,
  /referential\s+integrity/i,
];

const TIMEOUT_PATTERNS = [
  /timeout|timed?\s*out/i,
  /statement\s+timeout/i,
  /canceling\s+statement\s+due\s+to\s+statement\s+timeout/i,
];

const classifyByMessage = (message: string): ErrorCategory | null => {
  for (const pattern of TIMEOUT_PATTERNS) {
    if (pattern.test(message)) {
      return "timeout";
    }
  }
  for (const pattern of CONNECTION_PATTERNS) {
    if (pattern.test(message)) {
      return "connection";
    }
  }
  for (const pattern of SYNTAX_PATTERNS) {
    if (pattern.test(message)) {
      return "syntax";
    }
  }
  for (const pattern of PERMISSION_PATTERNS) {
    if (pattern.test(message)) {
      return "permission";
    }
  }
  for (const pattern of NOT_FOUND_PATTERNS) {
    if (pattern.test(message)) {
      return "not-found";
    }
  }
  for (const pattern of CONSTRAINT_PATTERNS) {
    if (pattern.test(message)) {
      return "constraint";
    }
  }
  return null;
};

const CLASSIFICATIONS: Record<
  ErrorCategory,
  Omit<ErrorClassification, "category">
> = {
  connection: {
    hint: "Check that the database server is running and reachable, then reconnect.",
    label: "Connection",
    summary: "The database connection was lost or couldn't be established.",
  },
  constraint: {
    hint: "Check the data you're inserting or updating against the table's constraints.",
    label: "Constraint",
    summary: "The operation violates a database constraint.",
  },
  "not-found": {
    hint: "Check for typos in table, column, or function names. Use the schema tree to verify.",
    label: "Not Found",
    summary: "A referenced table, column, or function doesn't exist.",
  },
  permission: {
    hint: "Check that your database user has the required privileges for this operation.",
    label: "Permission",
    summary: "You don't have permission to perform this operation.",
  },
  syntax: {
    hint: "Check the highlighted line for typos, missing keywords, or mismatched quotes.",
    label: "Syntax",
    summary: "The SQL contains a syntax error the database can't parse.",
  },
  timeout: {
    hint: "Try simplifying the query, adding indexes, or increasing the timeout.",
    label: "Timeout",
    summary: "The query took too long and was cancelled by the server.",
  },
  unknown: {
    hint: "Check the full error message below for details.",
    label: "Error",
    summary: "Something went wrong while running the query.",
  },
};

export const classifyError = (
  message: string,
  code: string | null
): ErrorClassification => {
  const category =
    (code ? classifyByCode(code) : null) ??
    classifyByMessage(message) ??
    "unknown";

  return { category, ...CLASSIFICATIONS[category] };
};
