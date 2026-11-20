import { describe, expect, it } from "vitest";

import type { CardViewKind } from "@/lib/card-data";

import { matchViewSwitch } from "./view-switch";

const VIEWS: CardViewKind[] = ["line", "bar", "area", "table"];

describe("matchViewSwitch", () => {
  it.each([
    ["as a table", "table"],
    ["show as line", "line"],
    ["Bar chart", "bar"],
    ["bars", "bar"],
    ["switch to an area chart", "area"],
    ["  table  ", "table"],
  ])("switches %j to %s", (text, view) => {
    expect(matchViewSwitch(text, VIEWS)).toBe(view);
  });

  it.each([
    ["pie chart", "a view this answer can't take"],
    ["only Europe as a table", "a phrase that also changes the data"],
    ["by month", "a refine"],
    ["", "an empty draft"],
  ])("leaves %j alone (%s)", (text) => {
    expect(matchViewSwitch(text, VIEWS)).toBeNull();
  });
});
