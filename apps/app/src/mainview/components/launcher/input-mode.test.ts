import { describe, expect, it } from "vitest";

import { parseLauncherInput } from "./input-mode";

describe("parseLauncherInput", () => {
  it.each([
    ["> select 1", { mode: "sql", sql: "select 1" }],
    [">select 1", { mode: "sql", sql: "select 1" }],
    ["   >  select 1  ", { mode: "sql", sql: "select 1" }],
    [">", { mode: "sql", sql: "" }],
    [">> x", { mode: "sql", sql: "> x" }],
    ["#ord", { mode: "table", needle: "ord" }],
    ["# public.orders ", { mode: "table", needle: "public.orders" }],
    ["#", { mode: "table", needle: "" }],
    ["@", { mode: "connection", needle: "" }],
    ["@anal", { mode: "connection", needle: "anal" }],
    ["  @anal", { mode: "connection", needle: "anal" }],
    ["@anal ", { lookup: null, mode: "search", text: "@anal " }],
    ["@foo bar", { lookup: null, mode: "search", text: "@foo bar" }],
    [
      "revenue by region",
      { lookup: null, mode: "search", text: "revenue by region" },
    ],
    ["", { lookup: null, mode: "search", text: "" }],
    ["a > b", { lookup: null, mode: "search", text: "a > b" }],
    [
      " ada@example.com ",
      {
        lookup: { kind: "email", value: "ada@example.com" },
        mode: "search",
        text: " ada@example.com ",
      },
    ],
    [
      "42",
      { lookup: { kind: "integer", value: "42" }, mode: "search", text: "42" },
    ],
    [
      "3F2A1B4C-9D8E-4F7A-B6C5-D4E3F2A1C91E",
      {
        lookup: { kind: "uuid", value: "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e" },
        mode: "search",
        text: "3F2A1B4C-9D8E-4F7A-B6C5-D4E3F2A1C91E",
      },
    ],
  ] as const)("reads %j", (raw, expected) => {
    expect(parseLauncherInput(raw)).toStrictEqual(expected);
  });
});
