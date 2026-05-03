import { describe, expect, it } from "vitest";

import { formatLocationLabel, parseErrorLocation } from "@/lib/error-location";

describe("parseErrorLocation", () => {
  it("extracts a numeric position from JSON-style errors", () => {
    expect(parseErrorLocation("Unexpected token at position 42")).toStrictEqual(
      { position: 42 }
    );
  });

  it("extracts line and column from parenthesised hints", () => {
    expect(
      parseErrorLocation("syntax error (line 12, col 7) near comma")
    ).toStrictEqual({ column: 7, line: 12 });
  });

  it("accepts the spelled-out 'column' variant in parens", () => {
    expect(
      parseErrorLocation("error (line 3, column 8): unexpected EOF")
    ).toStrictEqual({ column: 8, line: 3 });
  });

  it("extracts a bare line+column phrase", () => {
    expect(parseErrorLocation("oops on line 9, col 4")).toStrictEqual({
      column: 4,
      line: 9,
    });
  });

  it("extracts a bare line-only phrase when no column is given", () => {
    expect(parseErrorLocation("error near line 17")).toStrictEqual({
      column: undefined,
      line: 17,
    });
  });

  it("recognises the postgres `LINE n:` prefix", () => {
    expect(
      parseErrorLocation("ERROR:  syntax error\nLINE 5: SELECT FORM users")
    ).toStrictEqual({ column: undefined, line: 5 });
  });

  it("prefers the position match over line/column when both appear", () => {
    expect(parseErrorLocation("at position 12 on line 3, col 4")).toStrictEqual(
      { position: 12 }
    );
  });

  it("returns null when nothing matches", () => {
    expect(
      parseErrorLocation("something is wrong but no coordinates")
    ).toBeNull();
  });
});

describe("formatLocationLabel", () => {
  it("formats line + column", () => {
    expect(formatLocationLabel({ column: 4, line: 9 })).toBe("line 9, col 4");
  });

  it("formats line-only when column is missing", () => {
    expect(formatLocationLabel({ line: 9 })).toBe("line 9");
  });

  it("formats a position when no line is present", () => {
    expect(formatLocationLabel({ position: 42 })).toBe("position 42");
  });

  it("falls back to a generic label when nothing is set", () => {
    expect(formatLocationLabel({})).toBe("location");
  });
});
