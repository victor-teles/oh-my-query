import { describe, expect, it } from "vitest";

import { compareValues, formatCell, isNull, isNumber } from "@/lib/format-cell";

describe("cell value formatting", () => {
  it("renders null and undefined as NULL", () => {
    expect(formatCell(null)).toBe("NULL");
    expect(formatCell()).toBe("NULL");
  });

  it("renders booleans as lowercase strings", () => {
    expect(formatCell(true)).toBe("true");
    expect(formatCell(false)).toBe("false");
  });

  it("serializes objects via JSON", () => {
    expect(formatCell({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}');
  });

  it("falls back to String() for objects that throw on stringify", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatCell(circular)).toBe("[object Object]");
  });

  it("renders primitives via String()", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell("hi")).toBe("hi");
  });
});

describe("isNull and isNumber predicates", () => {
  it("isNull covers null and undefined", () => {
    expect(isNull(null)).toBeTruthy();
    expect(isNull()).toBeTruthy();
    expect(isNull(0)).toBeFalsy();
    expect(isNull("")).toBeFalsy();
  });

  it("isNumber only matches typeof number", () => {
    expect(isNumber(1)).toBeTruthy();
    expect(isNumber(Number.NaN)).toBeTruthy();
    expect(isNumber("1")).toBeFalsy();
    expect(isNumber(null)).toBeFalsy();
  });
});

describe("compareValues sorting", () => {
  it("treats equal nulls as equal", () => {
    expect(compareValues(null, null)).toBe(0);
    expect(compareValues(undefined, null)).toBe(0);
  });

  it("sorts nulls after values", () => {
    expect(compareValues(null, 5)).toBeGreaterThan(0);
    expect(compareValues(5, null)).toBeLessThan(0);
  });

  it("compares numbers numerically", () => {
    expect(compareValues(10, 2)).toBeGreaterThan(0);
    expect(compareValues(2, 10)).toBeLessThan(0);
  });

  it("compares booleans with false first", () => {
    expect(compareValues(false, true)).toBeLessThan(0);
    expect(compareValues(true, false)).toBeGreaterThan(0);
    expect(compareValues(true, true)).toBe(0);
  });

  it("compares strings with numeric-aware collation", () => {
    const items = ["item10", "item2", "item1"];
    items.sort(compareValues);
    expect(items).toStrictEqual(["item1", "item2", "item10"]);
  });
});
