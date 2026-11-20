import { describe, expect, it } from "vitest";

import { flattenPastedSql, hasLineBreak } from "./flatten-pasted-sql";

describe("flattenPastedSql", () => {
  it("turns line breaks into spaces", () => {
    expect(flattenPastedSql("select a\nfrom t\r\nwhere b = 1")).toBe(
      "select a from t where b = 1"
    );
  });

  it("keeps a line comment from swallowing the rest", () => {
    expect(flattenPastedSql("-- Revenue by month\nselect 1\n-- tail")).toBe(
      "/* Revenue by month */ select 1 /* tail */"
    );
  });

  it("escapes a block-comment terminator inside a line comment", () => {
    expect(flattenPastedSql("-- a */ b\nselect 1")).toBe(
      "/* a * / b */ select 1"
    );
  });

  it("leaves block comments and strings alone", () => {
    expect(flattenPastedSql("select '--x' /* y */\nfrom t")).toBe(
      "select '--x' /* y */ from t"
    );
  });

  it("falls back to plain joining on an unterminated string", () => {
    expect(flattenPastedSql("select 'oops\nfrom t")).toBe(
      "select 'oops from t"
    );
  });
});

describe("hasLineBreak", () => {
  it.each([
    ["a\nb", true],
    ["a\rb", true],
    ["ab", false],
  ])("%j → %s", (text, expected) => {
    expect(hasLineBreak(text)).toBe(expected);
  });
});
