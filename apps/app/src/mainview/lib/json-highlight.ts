import type { Token, TokenKind } from "@/lib/sql-highlight";

import { splitLines } from "@/lib/sql-highlight";

const STRING = /^"(?:\\.|[^"\\])*("?)/;
const NUMBER = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const LITERAL = /^(?:true|false|null)\b/;
const PUNCTUATION = /^[{}[\]:,]/;
const SPACE = /^\s+/;
const COMMAND_WORD = /^[A-Z][A-Z_]+$/;
const IS_KEY = /^\s*:/;

const keyKind = (text: string): TokenKind =>
  text.startsWith("$") ? "keyword" : "identifier";

const valueKind = (text: string): TokenKind => {
  if (text.startsWith("$")) {
    return "function";
  }
  return COMMAND_WORD.test(text) ? "keyword" : "string";
};

const stringTokens = (
  quoted: string,
  closed: boolean,
  rest: string
): Token[] => {
  const inner = quoted.slice(1, closed ? -1 : undefined);
  const isKey = closed && IS_KEY.test(rest);
  const kind = isKey ? keyKind(inner) : valueKind(inner);
  const tokens: Token[] = [{ kind: "punctuation", text: '"' }];
  if (inner) {
    tokens.push({ kind, text: inner });
  }
  if (closed) {
    tokens.push({ kind: "punctuation", text: '"' });
  }
  return tokens;
};

const tokensAt = (rest: string): { tokens: Token[]; length: number } => {
  const quoted = STRING.exec(rest);
  if (quoted) {
    const [text, closing] = quoted;
    const after = rest.slice(text.length);
    return {
      length: text.length,
      tokens: stringTokens(text, closing === '"', after),
    };
  }
  const rules: [TokenKind, RegExp][] = [
    ["plain", SPACE],
    ["number", NUMBER],
    ["number", LITERAL],
    ["punctuation", PUNCTUATION],
  ];
  for (const [kind, pattern] of rules) {
    const text = pattern.exec(rest)?.[0];
    if (text) {
      return { length: text.length, tokens: [{ kind, text }] };
    }
  }
  return { length: 1, tokens: [{ kind: "plain", text: rest.charAt(0) }] };
};

export const tokenizeJson = (text: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const next = tokensAt(text.slice(index));
    for (const token of next.tokens) {
      const previous = tokens.at(-1);
      if (previous?.kind === "plain" && token.kind === "plain") {
        previous.text += token.text;
      } else {
        tokens.push({ ...token });
      }
    }
    index += next.length;
  }
  return tokens;
};

export const highlightJsonLines = (text: string): Token[][] =>
  splitLines(tokenizeJson(text));
