import { describe, expect, it } from "vitest";

import { draftOf, submissionOf } from "./ask-draft";

describe("draftOf", () => {
  it("prefixes SQL sources so the draft re-runs as SQL", () => {
    expect(draftOf({ prompt: "select 1", source: "sql" })).toBe("> select 1");
    expect(draftOf({ prompt: "revenue", source: "question" })).toBe("revenue");
  });
});

describe("submissionOf", () => {
  it.each([
    ["> select 1", { source: "sql", text: "select 1" }],
    ["  revenue by region ", { source: "question", text: "revenue by region" }],
    ["#orders", { source: "question", text: "#orders" }],
    ["@analytics", { source: "question", text: "@analytics" }],
    [">", null],
    ["   ", null],
  ] as const)("reads %j", (draft, expected) => {
    expect(submissionOf(draft)).toStrictEqual(expected);
  });
});
