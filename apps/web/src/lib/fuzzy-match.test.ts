import { describe, expect, it } from "vitest";

import { fuzzyMatch } from "@/lib/fuzzy-match";

describe("fuzzy matching", () => {
  it("matches an empty query against anything with a zero score", () => {
    expect(fuzzyMatch("users", "")).toStrictEqual({ matches: [], score: 0 });
  });

  it("returns null when the query cannot be consumed in order", () => {
    expect(fuzzyMatch("users", "xy")).toBeNull();
    expect(fuzzyMatch("abc", "cab")).toBeNull();
  });

  it("rewards prefix matches more than mid-word matches", () => {
    const prefix = fuzzyMatch("orders", "ord");
    const mid = fuzzyMatch("word_orders", "ord");
    expect(prefix).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(prefix?.score ?? 0).toBeGreaterThan(mid?.score ?? 0);
  });

  it("rewards word-boundary matches after separators", () => {
    const afterUnderscore = fuzzyMatch("user_orders", "or");
    const midWord = fuzzyMatch("customorders", "or");
    expect(afterUnderscore).not.toBeNull();
    expect(midWord).not.toBeNull();
    expect(afterUnderscore?.score ?? 0).toBeGreaterThan(midWord?.score ?? 0);
  });

  it("records match positions in order", () => {
    const result = fuzzyMatch("user_orders", "uso");
    expect(result).not.toBeNull();
    expect(result?.matches).toStrictEqual([0, 1, 5]);
  });

  it("is case insensitive but bonuses exact-case matches", () => {
    const exact = fuzzyMatch("Orders", "Or");
    const insensitive = fuzzyMatch("Orders", "or");
    expect(exact).not.toBeNull();
    expect(insensitive).not.toBeNull();
    expect(exact?.score ?? 0).toBeGreaterThan(insensitive?.score ?? 0);
  });
});
