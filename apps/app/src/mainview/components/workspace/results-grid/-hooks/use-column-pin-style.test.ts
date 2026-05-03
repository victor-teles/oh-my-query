import type { Column } from "@tanstack/react-table";

import { describe, expect, it } from "vitest";

import {
  buildPinStyle,
  getColumnPinFacts,
  getColumnPinStyle,
} from "./use-column-pin-style";

interface ColumnFake {
  pinned: false | "left" | "right";
  isLastLeft?: boolean;
  isFirstRight?: boolean;
  startLeft?: number;
  afterRight?: number;
}

const fakeColumn = ({
  pinned,
  isLastLeft = false,
  isFirstRight = false,
  startLeft = 0,
  afterRight = 0,
}: ColumnFake): Column<unknown[], unknown> =>
  ({
    getAfter: () => afterRight,
    getIsFirstColumn: (side: "left" | "right") =>
      side === "right" && isFirstRight,
    getIsLastColumn: (side: "left" | "right") => side === "left" && isLastLeft,
    getIsPinned: () => pinned,
    getStart: () => startLeft,
  }) as unknown as Column<unknown[], unknown>;

describe("getColumnPinFacts", () => {
  it("returns the unpinned baseline", () => {
    expect(getColumnPinFacts(fakeColumn({ pinned: false }))).toStrictEqual({
      isFirstRight: false,
      isLastLeft: false,
      offset: 0,
      pinned: false,
    });
  });

  it("derives offset from getStart for left-pinned columns", () => {
    expect(
      getColumnPinFacts(
        fakeColumn({ isLastLeft: true, pinned: "left", startLeft: 120 })
      )
    ).toStrictEqual({
      isFirstRight: false,
      isLastLeft: true,
      offset: 120,
      pinned: "left",
    });
  });

  it("derives offset from getAfter for right-pinned columns", () => {
    expect(
      getColumnPinFacts(
        fakeColumn({ afterRight: 80, isFirstRight: true, pinned: "right" })
      )
    ).toStrictEqual({
      isFirstRight: true,
      isLastLeft: false,
      offset: 80,
      pinned: "right",
    });
  });
});

describe("buildPinStyle", () => {
  it("returns empty style and attrs when not pinned", () => {
    expect(
      buildPinStyle({
        isFirstRight: false,
        isLastLeft: false,
        offset: 0,
        pinned: false,
      })
    ).toStrictEqual({ dataAttrs: {}, style: {} });
  });

  it("emits sticky left styling and data attrs for the last left pin", () => {
    expect(
      buildPinStyle({
        isFirstRight: false,
        isLastLeft: true,
        offset: 100,
        pinned: "left",
      })
    ).toStrictEqual({
      dataAttrs: {
        "data-first-right-pin": undefined,
        "data-last-left-pin": "",
        "data-pinned": "left",
      },
      style: { left: 100, position: "sticky" },
    });
  });

  it("emits sticky right styling for the first right pin", () => {
    expect(
      buildPinStyle({
        isFirstRight: true,
        isLastLeft: false,
        offset: 50,
        pinned: "right",
      })
    ).toStrictEqual({
      dataAttrs: {
        "data-first-right-pin": "",
        "data-last-left-pin": undefined,
        "data-pinned": "right",
      },
      style: { position: "sticky", right: 50 },
    });
  });
});

describe("getColumnPinStyle", () => {
  it("composes facts and style for a pinned column", () => {
    const result = getColumnPinStyle(
      fakeColumn({ isLastLeft: true, pinned: "left", startLeft: 40 })
    );

    expect(result.style).toStrictEqual({ left: 40, position: "sticky" });
    expect(result.dataAttrs["data-pinned"]).toBe("left");
    expect(result.dataAttrs["data-last-left-pin"]).toBe("");
  });
});
