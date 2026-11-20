import { describe, expect, it } from "vitest";

import { focusAfterLauncherHides } from "./focus-policy.ts";

describe("focusAfterLauncherHides", () => {
  it("keeps activation when a board took focus", () => {
    expect(
      focusAfterLauncherHides({
        focusedBoardId: "b1",
        openBoardIds: ["b1"],
        returnBoardId: null,
      })
    ).toStrictEqual({ kind: "keep" });
  });

  it("returns to the board that summoned the launcher", () => {
    expect(
      focusAfterLauncherHides({
        focusedBoardId: null,
        openBoardIds: ["b1", "b2"],
        returnBoardId: "b2",
      })
    ).toStrictEqual({ boardId: "b2", kind: "activate" });
  });

  it("deactivates without hiding when boards stay open", () => {
    expect(
      focusAfterLauncherHides({
        focusedBoardId: null,
        openBoardIds: ["b1"],
        returnBoardId: "gone",
      })
    ).toStrictEqual({ kind: "deactivate" });
  });

  it("hides the app when nothing else is open", () => {
    expect(
      focusAfterLauncherHides({
        focusedBoardId: null,
        openBoardIds: [],
        returnBoardId: null,
      })
    ).toStrictEqual({ kind: "hide" });
  });
});
