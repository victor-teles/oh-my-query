import type { Column } from "@tanstack/react-table";
import type { CSSProperties } from "react";

export interface PinFacts {
  pinned: "left" | "right" | false;
  offset: number;
  isLastLeft: boolean;
  isFirstRight: boolean;
}

export interface PinStyle {
  style: CSSProperties;
  dataAttrs: {
    "data-pinned"?: "left" | "right";
    "data-last-left-pin"?: "";
    "data-first-right-pin"?: "";
  };
}

export const getColumnPinFacts = (
  column: Column<unknown[], unknown>
): PinFacts => {
  const pinned = column.getIsPinned();
  if (pinned === false) {
    return { isFirstRight: false, isLastLeft: false, offset: 0, pinned: false };
  }
  const isLastLeft =
    pinned === "left" && column.getIsLastColumn("left") === true;
  const isFirstRight =
    pinned === "right" && column.getIsFirstColumn("right") === true;
  const offset =
    pinned === "left" ? column.getStart("left") : column.getAfter("right");
  return { isFirstRight, isLastLeft, offset, pinned };
};

export const buildPinStyle = (facts: PinFacts): PinStyle => {
  if (facts.pinned === false) {
    return { dataAttrs: {}, style: {} };
  }
  const style: CSSProperties = { position: "sticky" };
  if (facts.pinned === "left") {
    style.left = facts.offset;
  } else {
    style.right = facts.offset;
  }
  return {
    dataAttrs: {
      "data-first-right-pin": facts.isFirstRight ? "" : undefined,
      "data-last-left-pin": facts.isLastLeft ? "" : undefined,
      "data-pinned": facts.pinned,
    },
    style,
  };
};

export const getColumnPinStyle = (
  column: Column<unknown[], unknown>
): PinStyle => buildPinStyle(getColumnPinFacts(column));
