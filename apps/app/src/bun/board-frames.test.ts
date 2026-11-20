import { describe, expect, it } from "vitest";

import {
  defaultBoardFrame,
  parseBoardFrames,
  restoredBoardFrame,
} from "./board-frames.ts";

const screen = { height: 900, width: 1440, x: 0, y: 25 };
const external = { height: 1080, width: 1920, x: 1440, y: 0 };

describe("board frames", () => {
  it("centres a default 1100×760 frame on the work area", () => {
    expect(defaultBoardFrame(screen)).toStrictEqual({
      height: 760,
      width: 1100,
      x: 170,
      y: 95,
    });
  });

  it("shrinks the default frame to a small work area", () => {
    expect(
      defaultBoardFrame({ height: 600, width: 900, x: 0, y: 0 })
    ).toStrictEqual({
      height: 600,
      width: 900,
      x: 0,
      y: 0,
    });
  });

  it("restores a remembered frame on a connected display", () => {
    const frame = { height: 700, width: 1000, x: 1600, y: 100 };
    expect(restoredBoardFrame(frame, [screen, external], screen)).toBe(frame);
  });

  it("falls back when the remembered display is gone", () => {
    const frame = { height: 700, width: 1000, x: 1600, y: 100 };
    expect(restoredBoardFrame(frame, [screen], screen)).toStrictEqual(
      defaultBoardFrame(screen)
    );
    expect(restoredBoardFrame(undefined, [screen], screen)).toStrictEqual(
      defaultBoardFrame(screen)
    );
  });

  it("parses stored frames and drops malformed entries", () => {
    expect(
      parseBoardFrames(
        JSON.stringify({
          a: { height: 1, width: 2, x: 3, y: 4 },
          b: { x: "1" },
        })
      )
    ).toStrictEqual({ a: { height: 1, width: 2, x: 3, y: 4 } });
    expect(parseBoardFrames("not json")).toStrictEqual({});
    expect(parseBoardFrames("null")).toStrictEqual({});
  });
});
