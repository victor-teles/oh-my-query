import { describe, expect, it } from "vitest";

import { highlightLines, tokenizeSql } from "./sql-highlight";

const kinds = (sql: string) =>
  tokenizeSql(sql)
    .filter((token) => token.text.trim())
    .map((token) => `${token.kind}:${token.text}`);

describe("tokenizeSql", () => {
  it("classifies keywords, functions, identifiers, numbers and punctuation", () => {
    expect(
      kinds("SELECT sum(total_cents) / 100.0 AS mrr FROM orders;")
    ).toStrictEqual([
      "keyword:SELECT",
      "function:sum",
      "punctuation:(",
      "identifier:total_cents",
      "punctuation:)",
      "punctuation:/",
      "number:100.0",
      "keyword:AS",
      "identifier:mrr",
      "keyword:FROM",
      "identifier:orders",
      "punctuation:;",
    ]);
  });

  it("recognizes comments, strings and quoted identifiers", () => {
    expect(
      kinds(`-- note\nselect 'it''s', "Order" from t /* x */`)
    ).toStrictEqual([
      "comment:-- note",
      "keyword:select",
      "string:'it''s'",
      "punctuation:,",
      'identifier:"Order"',
      "keyword:from",
      "identifier:t",
      "comment:/* x */",
    ]);
  });

  it("tolerates SQL cut off mid-token while streaming", () => {
    expect(kinds("select 'unfinis")).toStrictEqual([
      "keyword:select",
      "string:'unfinis",
    ]);
    expect(kinds("select 1 /* still")).toStrictEqual([
      "keyword:select",
      "number:1",
      "comment:/* still",
    ]);
    expect(kinds('select "Ord')).toStrictEqual([
      "keyword:select",
      'identifier:"Ord',
    ]);
  });

  it("keeps every character, so joining tokens rebuilds the input", () => {
    const sql = "select a::text, b <> 2 || '\n' from t\n  where x >= 1.5e3 @ ?";
    expect(
      tokenizeSql(sql)
        .map((token) => token.text)
        .join("")
    ).toBe(sql);
  });
});

describe("highlightLines", () => {
  it("splits tokens across lines, including multi-line comments", () => {
    const lines = highlightLines("select 1\n/* a\nb */ from t\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toStrictEqual([{ kind: "comment", text: "/* a" }]);
    expect(lines[2]?.[0]).toStrictEqual({ kind: "comment", text: "b */" });
    expect(lines[3]).toStrictEqual([]);
  });
});
