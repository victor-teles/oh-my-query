export type TokenKind =
  | "keyword"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "identifier"
  | "punctuation"
  | "plain";

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set(
  `select from where group by order having limit offset with as on join left
  right inner outer full cross natural using and or not in is null like ilike
  between case when then else end distinct all union intersect except asc desc
  nulls first last over partition rows range preceding following current row
  filter within interval true false exists any some values table show describe
  explain lateral recursive top fetch next only window qualify cast date
  timestamp time zone at extract insert into update delete set drop create alter
  truncate merge replace returning grant revoke`
    .split(/\s+/)
    .filter(Boolean)
);

const RULES: [TokenKind, RegExp][] = [
  ["comment", /^--[^\n]*/],
  ["comment", /^\/\*[\s\S]*?(?:\*\/|$)/],
  ["string", /^'(?:''|[^'])*(?:'|$)/],
  ["string", /^\$\$[\s\S]*?(?:\$\$|$)/],
  ["identifier", /^"(?:""|[^"])*(?:"|$)/],
  ["identifier", /^`[^`]*(?:`|$)/],
  ["number", /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i],
  ["plain", /^[A-Za-z_][\w$]*/],
  ["plain", /^\s+/],
  ["punctuation", /^(?:::|<=|>=|<>|!=|\|\||[(),.;*=<>+\-/%])/],
];

const FUNCTION_CALL = /^\s*\(/;

const classifyWord = (word: string, rest: string): TokenKind => {
  if (KEYWORDS.has(word.toLowerCase())) {
    return "keyword";
  }
  return FUNCTION_CALL.test(rest) ? "function" : "identifier";
};

const matchAt = (rest: string): Token => {
  for (const [kind, pattern] of RULES) {
    const text = pattern.exec(rest)?.[0];
    if (!text) {
      continue;
    }
    if (kind === "plain" && /^[A-Za-z_]/.test(text)) {
      return { kind: classifyWord(text, rest.slice(text.length)), text };
    }
    return { kind, text };
  }
  return { kind: "plain", text: rest.charAt(0) };
};

export const tokenizeSql = (sql: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < sql.length) {
    const token = matchAt(sql.slice(index));
    const previous = tokens.at(-1);
    if (previous && previous.kind === token.kind && token.kind === "plain") {
      previous.text += token.text;
    } else {
      tokens.push(token);
    }
    index += token.text.length;
  }
  return tokens;
};

export const highlightLines = (sql: string): Token[][] => {
  const lines: Token[][] = [[]];
  for (const token of tokenizeSql(sql)) {
    const parts = token.text.split("\n");
    for (const [index, text] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
      }
      if (text) {
        lines.at(-1)?.push({ kind: token.kind, text });
      }
    }
  }
  return lines;
};

export const SQL_TOKEN_CLASSES: Record<TokenKind, string> = {
  comment: "text-panel-muted italic",
  function: "text-chart-4",
  identifier: "text-foreground",
  keyword: "text-chart-1",
  number: "text-chart-2",
  plain: "text-foreground",
  punctuation: "text-panel-muted",
  string: "text-chart-5",
};
