import type { DialectType } from "@oh-my-query/core";

import { classifyStandardSql } from "@oh-my-query/core/client";

export type ReadOnlyVerdict = { ok: true } | { ok: false; reason: string };

interface LexFlavor {
  backslashEscapes: boolean;
  hashComments: boolean;
  dashCommentNeedsSpace: boolean;
  dollarQuotes: boolean;
}

// Each engine lexes quotes and comments differently. A statement passes only
// when every flavor agrees, so a literal one engine reads as data can never
// hide code that another engine would execute.
const FLAVORS: readonly LexFlavor[] = [
  {
    backslashEscapes: false,
    dashCommentNeedsSpace: false,
    dollarQuotes: true,
    hashComments: false,
  },
  {
    backslashEscapes: true,
    dashCommentNeedsSpace: true,
    dollarQuotes: false,
    hashComments: true,
  },
];

const ALLOWED_LEADING_KEYWORDS = new Set([
  "select",
  "with",
  "show",
  "describe",
  "desc",
  "explain",
  "values",
  "table",
]);

const FORBIDDEN_WORDS = [
  "insert",
  "update",
  "delete",
  "merge",
  "upsert",
  String.raw`replace\s+into`,
  "create",
  "drop",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "copy",
  "call",
  "exec",
  "execute",
  "attach",
  "detach",
  "vacuum",
  "set",
  "lock",
  "into",
  "load",
  "install",
  "commit",
  "rollback",
  "pragma",
  "pg_sleep",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "dblink",
];

const FORBIDDEN = new RegExp(
  String.raw`\b(${FORBIDDEN_WORDS.join("|")})\b`,
  "i"
);
const LEADING_WORD = /^[\s(]*([a-z_]+)/i;
const DOLLAR_TAG = /^\$([A-Za-z_]\w*)?\$/;
const IDENTIFIER_CHAR = /\w/;
const EXECUTABLE_COMMENT = /\/\*!/;
const WHITESPACE = /\s/;

const reject = (reason: string): ReadOnlyVerdict => ({ ok: false, reason });

const closingQuote = (
  sql: string,
  start: number,
  quote: string,
  backslashEscapes: boolean
): number => {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (backslashEscapes && char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      if (sql[index + 1] !== quote) {
        return index;
      }
      index += 2;
      continue;
    }
    index += 1;
  }
  return -1;
};

const lineEnd = (sql: string, start: number): number => {
  const end = sql.indexOf("\n", start);
  return end === -1 ? sql.length : end;
};

const isDashComment = (
  sql: string,
  index: number,
  flavor: LexFlavor
): boolean => {
  if (sql[index] !== "-" || sql[index + 1] !== "-") {
    return false;
  }
  if (!flavor.dashCommentNeedsSpace) {
    return true;
  }
  const after = sql[index + 2];
  return after === undefined || WHITESPACE.test(after);
};

const dollarQuoteEnd = (sql: string, start: number): number | null => {
  if (start > 0 && IDENTIFIER_CHAR.test(sql[start - 1] ?? "")) {
    return null;
  }
  const tag = DOLLAR_TAG.exec(sql.slice(start))?.[0];
  if (!tag) {
    return null;
  }
  const close = sql.indexOf(tag, start + tag.length);
  return close === -1 ? -1 : close + tag.length;
};

const QUOTED_IDENTIFIERS = new Set(['"', "`"]);
const COMMENT = " ";
const STRING = " '' ";
const IDENTIFIER = ' "" ';

interface Lexer extends LexFlavor {
  bracketIdentifiers: boolean;
}

interface Literal {
  end: number;
  replacement: string;
}

const past = (end: number, width: number): number =>
  end === -1 ? -1 : end + width;

const literalAt = (
  sql: string,
  index: number,
  lexer: Lexer
): Literal | null => {
  const char = sql[index] ?? "";
  if (char === "/" && sql[index + 1] === "*") {
    return { end: past(sql.indexOf("*/", index + 2), 2), replacement: COMMENT };
  }
  if (
    isDashComment(sql, index, lexer) ||
    (lexer.hashComments && char === "#")
  ) {
    return { end: lineEnd(sql, index), replacement: COMMENT };
  }
  if (char === "'" || QUOTED_IDENTIFIERS.has(char)) {
    const escapes = lexer.backslashEscapes && char !== "`";
    const end = past(closingQuote(sql, index, char, escapes), 1);
    return { end, replacement: char === "'" ? STRING : IDENTIFIER };
  }
  if (char === "[" && lexer.bracketIdentifiers) {
    return {
      end: past(sql.indexOf("]", index + 1), 1),
      replacement: IDENTIFIER,
    };
  }
  if (char === "$" && lexer.dollarQuotes) {
    const end = dollarQuoteEnd(sql, index);
    return end === null ? null : { end, replacement: STRING };
  }
  return null;
};

const stripLiterals = (sql: string, lexer: Lexer): string | null => {
  let out = "";
  let index = 0;
  while (index < sql.length) {
    const literal = literalAt(sql, index, lexer);
    if (!literal) {
      out += sql[index];
      index += 1;
      continue;
    }
    if (literal.end === -1) {
      return null;
    }
    out += literal.replacement;
    index = literal.end;
  }
  return out;
};

const stripTrailingSemicolons = (sql: string): string =>
  sql.trim().replace(/;[\s;]*$/, "");

const checkLexed = (code: string): ReadOnlyVerdict => {
  const statement = stripTrailingSemicolons(code);
  if (!statement) {
    return reject("The statement is empty.");
  }
  if (statement.includes(";")) {
    return reject("Only one statement can run at a time.");
  }
  const leading = LEADING_WORD.exec(statement)?.[1]?.toLowerCase();
  if (!(leading && ALLOWED_LEADING_KEYWORDS.has(leading))) {
    const shown = leading ? leading.toUpperCase() : "an unknown keyword";
    return reject(`Only read-only queries can run here, not ${shown}.`);
  }
  const forbidden = FORBIDDEN.exec(statement)?.[1];
  if (forbidden) {
    const word = forbidden.replaceAll(/\s+/g, " ").toUpperCase();
    return reject(`${word} is not allowed in a read-only query.`);
  }
  const destructive = classifyStandardSql(statement);
  if (destructive) {
    return reject(destructive.reason);
  }
  return { ok: true };
};

export const assertReadOnly = (
  sql: string,
  dialect: DialectType
): ReadOnlyVerdict => {
  if (EXECUTABLE_COMMENT.test(sql)) {
    return reject("Executable comments are not allowed.");
  }
  for (const flavor of FLAVORS) {
    const code = stripLiterals(sql, {
      ...flavor,
      bracketIdentifiers: dialect === "tsql",
    });
    if (code === null) {
      return reject("The statement has an unterminated string or comment.");
    }
    const verdict = checkLexed(code);
    if (!verdict.ok) {
      return verdict;
    }
  }
  return { ok: true };
};
