import { describe, expect, it } from "vitest";

import { nextPill } from "./argument-pills";
import { stepPreset } from "./preset-pill";
import { filterOptions } from "./select-pill";

describe("nextPill", () => {
  it("wraps in both directions", () => {
    expect(nextPill(-1, 1, 3)).toBe(0);
    expect(nextPill(2, 1, 3)).toBe(0);
    expect(nextPill(0, -1, 3)).toBe(2);
  });
});

describe("stepPreset", () => {
  it("starts at the ends when no preset is selected", () => {
    expect(stepPreset(-1, 1, 8)).toBe(0);
    expect(stepPreset(-1, -1, 8)).toBe(7);
  });

  it("wraps around", () => {
    expect(stepPreset(7, 1, 8)).toBe(0);
    expect(stepPreset(0, -1, 8)).toBe(7);
  });
});

describe("filterOptions", () => {
  const options = ["Asia Pacific", "Europe", "North America"];

  it("shows every option while the text is the current value", () => {
    expect(filterOptions(options, "Europe", "Europe")).toStrictEqual(options);
  });

  it("filters case-insensitively by substring", () => {
    expect(filterOptions(options, "AMER", "Europe")).toStrictEqual([
      "North America",
    ]);
  });
});
