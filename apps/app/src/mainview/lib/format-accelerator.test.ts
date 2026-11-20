import { describe, expect, it } from "vitest";

import { formatAccelerator } from "./format-accelerator";

describe("formatAccelerator", () => {
  it("renders the default launcher hotkey as macOS symbols", () => {
    expect(formatAccelerator("Option+Shift+Space")).toStrictEqual([
      "⌥",
      "⇧",
      "Space",
    ]);
  });

  it("maps command aliases and uppercases letters", () => {
    expect(formatAccelerator("CommandOrControl+k")).toStrictEqual(["⌘", "K"]);
    expect(formatAccelerator("cmd+shift+p")).toStrictEqual(["⌘", "⇧", "P"]);
  });

  it("ignores empty segments and surrounding spaces", () => {
    expect(formatAccelerator(" Control + Return ")).toStrictEqual(["⌃", "↩"]);
    expect(formatAccelerator("")).toStrictEqual([]);
  });
});
