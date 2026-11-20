import type { Rect } from "./launcher-geometry.ts";

export const BOARD_DEFAULT_WIDTH = 1100;
export const BOARD_DEFAULT_HEIGHT = 760;
const MIN_VISIBLE = 120;

export type BoardFrames = Record<string, Rect>;

export const defaultBoardFrame = (workArea: Rect): Rect => {
  const width = Math.min(BOARD_DEFAULT_WIDTH, workArea.width);
  const height = Math.min(BOARD_DEFAULT_HEIGHT, workArea.height);
  return {
    height,
    width,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  };
};

const overlaps = (frame: Rect, area: Rect): boolean =>
  frame.x + frame.width - MIN_VISIBLE > area.x &&
  frame.x + MIN_VISIBLE < area.x + area.width &&
  frame.y + MIN_VISIBLE > area.y &&
  frame.y < area.y + area.height - MIN_VISIBLE / 3;

// A remembered frame on a display that's gone would open off-screen.
export const restoredBoardFrame = (
  remembered: Rect | undefined,
  workAreas: readonly Rect[],
  fallback: Rect
): Rect =>
  remembered && workAreas.some((area) => overlaps(remembered, area))
    ? remembered
    : defaultBoardFrame(fallback);

const isRect = (value: unknown): value is Rect => {
  const rect = value as Partial<Rect> | null;
  return (
    typeof rect === "object" &&
    rect !== null &&
    [rect.x, rect.y, rect.width, rect.height].every(
      (n) => typeof n === "number" && Number.isFinite(n)
    )
  );
};

export const parseBoardFrames = (raw: string): BoardFrames => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, Rect] =>
        isRect(entry[1])
      )
    );
  } catch {
    return {};
  }
};
