import { describe, expect, it } from "vitest";

import { chainPrompt, MAX_ASK_TURNS, RefineContext } from "./refine.ts";

const SPEC = {
  formats: {},
  title: "Revenue by region",
  version: 1,
  view: { kind: "table" },
};

const valid = {
  chainId: "ask-1",
  spec: SPEC,
  sql: "select 1",
  turns: ["Revenue by region"],
};

describe("chainPrompt", () => {
  it.each([
    [[], "Revenue by region", "Revenue by region"],
    [["Revenue by region"], "only Europe", "Revenue by region · only Europe"],
    [["  MRR ", "by month"], " as a table ", "MRR · by month · as a table"],
    [["MRR"], "   ", "MRR"],
  ])("joins %j and %j", (turns, prompt, expected) => {
    expect(chainPrompt(turns, prompt)).toBe(expected);
  });
});

describe("refineContext", () => {
  it("accepts a context with earlier turns, SQL and a card", () => {
    expect(RefineContext.safeParse(valid).success).toBeTruthy();
  });

  it.each([
    ["no earlier turns", { ...valid, turns: [] }],
    [
      "too many turns",
      { ...valid, turns: Array.from({ length: MAX_ASK_TURNS }, () => "x") },
    ],
    ["SQL over the cap", { ...valid, sql: "x".repeat(20_001) }],
    ["an empty SQL", { ...valid, sql: "" }],
    ["an invalid card", { ...valid, spec: { title: "No view" } }],
    ["a blank turn", { ...valid, turns: ["   "] }],
  ])("rejects %s", (_label, input) => {
    expect(RefineContext.safeParse(input).success).toBeFalsy();
  });
});
