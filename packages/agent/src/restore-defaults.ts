import type { DialectType } from "@oh-my-query/core";

import { tokenizeSqlTemplate } from "@oh-my-query/core/client";
import { ParamDef, RangePreset } from "@oh-my-query/rpc";

export const NUMBER_LITERAL =
  /(?<![\w.])\d+(?:\.\d+)?(?:e[+-]?\d+)?(?![\w.])/gi;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const DOLLAR_TAG = /^\$[A-Za-z_]*\$/;

type Item =
  | { kind: "literal"; value: string }
  | { kind: "input"; name: string; part: "from" | "to" | null };

const unquote = (text: string): string | null => {
  if (text.startsWith("'")) {
    return text.slice(1, -1).replaceAll("''", "'");
  }
  const tag = DOLLAR_TAG.exec(text)?.[0];
  return tag ? text.slice(tag.length, -tag.length) : null;
};

const itemsOf = (sql: string, dialect: DialectType): Item[] =>
  tokenizeSqlTemplate(sql, dialect).flatMap((segment): Item[] => {
    switch (segment.kind) {
      case "placeholder": {
        return [{ kind: "input", name: segment.name, part: segment.part }];
      }
      case "literal": {
        const value = unquote(segment.text);
        return value === null ? [] : [{ kind: "literal", value }];
      }
      case "code": {
        return [...segment.text.matchAll(NUMBER_LITERAL)].map((match) => ({
          kind: "literal",
          value: match[0],
        }));
      }
      default: {
        return [];
      }
    }
  });

type Replaced = Map<string, string>;

const keyOf = (name: string, part: "from" | "to" | null) =>
  part ? `${name}.${part}` : name;

// The template differs from the query only in literals, so walking both in
// order pairs every input with the literal it replaced.
const replacedLiterals = (
  original: string,
  template: string,
  dialect: DialectType
): Replaced | null => {
  let before: Item[];
  let after: Item[];
  try {
    before = itemsOf(original, dialect);
    after = itemsOf(template, dialect);
  } catch {
    // verifyProposal reports a template that doesn't tokenize.
    return null;
  }
  if (before.length !== after.length) {
    return null;
  }
  const replaced: Replaced = new Map();
  for (const [index, item] of after.entries()) {
    const source = before[index];
    if (item.kind !== "input" || source?.kind !== "literal") {
      continue;
    }
    const key = keyOf(item.name, item.part);
    if (!replaced.has(key)) {
      replaced.set(key, source.value);
    }
  }
  return replaced;
};

const day = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : ISO_DAY.exec(value)?.[0];

const candidateDefault = (param: ParamDef, replaced: Replaced): unknown => {
  const literal = replaced.get(param.name);
  switch (param.type) {
    case "dateRange": {
      if (RangePreset.safeParse(param.default).success) {
        return param.default;
      }
      const current = typeof param.default === "object" ? param.default : null;
      return {
        from: day(replaced.get(`${param.name}.from`)) ?? current?.from,
        to: day(replaced.get(`${param.name}.to`)) ?? current?.to,
      };
    }
    case "date": {
      return day(literal) ?? param.default;
    }
    case "number": {
      return literal === undefined ? param.default : Number(literal);
    }
    default: {
      return literal ?? param.default;
    }
  }
};

export const restoreDefaults = (
  original: string,
  template: string,
  params: readonly ParamDef[],
  dialect: DialectType
): ParamDef[] => {
  const replaced = replacedLiterals(original, template, dialect);
  if (!replaced) {
    return [...params];
  }
  return params.map(
    (param) =>
      ParamDef.safeParse({
        ...param,
        default: candidateDefault(param, replaced),
      }).data ?? param
  );
};
