import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { animate, useMotionValue } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { SPRING_MOMENTUM } from "@/lib/motion";

import { findTileElement } from "./board-tile";

const DECELERATION = 0.998;

interface Point {
  x: number;
  y: number;
}

export interface DragState {
  tileId: string;
  from: number;
  over: number;
}

interface PointerTrack {
  grab: Point;
  pointer: Point;
  velocity: Point;
  time: number;
  slots: Point[];
}

// iOS-style projection: where a flick of velocity v (px/s) would come to rest.
export const projectPoint = (point: Point, velocity: Point): Point => {
  const travel = DECELERATION / (1 - DECELERATION) / 1000;
  return { x: point.x + velocity.x * travel, y: point.y + velocity.y * travel };
};

export const nearestSlot = (slots: readonly Point[], point: Point): number => {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, slot] of slots.entries()) {
    const distance = (slot.x - point.x) ** 2 + (slot.y - point.y) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
};

export const previewOrder = <T>(
  items: readonly T[],
  drag: DragState | null
): T[] => {
  if (!drag || drag.from === drag.over) {
    return [...items];
  }
  const moved = items[drag.from];
  if (moved === undefined) {
    return [...items];
  }
  return items.toSpliced(drag.from, 1).toSpliced(drag.over, 0, moved);
};

const center = (rect: DOMRect, origin: DOMRect): Point => ({
  x: rect.left - origin.left + rect.width / 2,
  y: rect.top - origin.top + rect.height / 2,
});

const tileElement = (tileId: string) =>
  findTileElement(tileId)?.parentElement ?? null;

interface UseTileDragOptions {
  gridRef: RefObject<HTMLElement | null>;
  tileIds: readonly string[];
  reduced: boolean;
  onDrop: (from: number, to: number) => void;
}

export const useTileDrag = ({
  gridRef,
  tileIds,
  reduced,
  onDrop,
}: UseTileDragOptions) => {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const track = useRef<PointerTrack | null>(null);

  const local = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const grid = gridRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (grid?.left ?? 0),
        y: event.clientY - (grid?.top ?? 0),
      };
    },
    [gridRef]
  );

  const followPointer = useCallback(
    (tileId: string) => {
      const element = tileElement(tileId);
      const { current } = track;
      if (!(element && current)) {
        return;
      }
      x.set(current.pointer.x - current.grab.x - element.offsetLeft);
      y.set(current.pointer.y - current.grab.y - element.offsetTop);
    },
    [x, y]
  );

  useLayoutEffect(() => {
    if (drag) {
      followPointer(drag.tileId);
    }
  }, [drag, followPointer]);

  useLayoutEffect(() => {
    if (!settling) {
      return;
    }
    followPointer(settling);
    const velocity = track.current?.velocity ?? { x: 0, y: 0 };
    if (reduced) {
      x.set(0);
      y.set(0);
      setSettling(null);
      return;
    }
    const options = { ...SPRING_MOMENTUM };
    const toX = animate(x, 0, { ...options, velocity: velocity.x });
    const toY = animate(y, 0, { ...options, velocity: velocity.y });
    const finish = async () => {
      try {
        await Promise.all([toX, toY]);
      } finally {
        setSettling(null);
      }
    };
    finish();
    return () => {
      toX.stop();
      toY.stop();
    };
  }, [followPointer, reduced, settling, x, y]);

  const start = useCallback(
    (tileId: string, event: ReactPointerEvent<HTMLElement>) => {
      const grid = gridRef.current;
      const element = tileElement(tileId);
      const from = tileIds.indexOf(tileId);
      if (!(grid && element) || from === -1 || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const origin = grid.getBoundingClientRect();
      const pointer = local(event);
      track.current = {
        grab: {
          x: pointer.x - element.offsetLeft,
          y: pointer.y - element.offsetTop,
        },
        pointer,
        slots: tileIds.map((id) => {
          const slot = tileElement(id);
          return slot
            ? center(slot.getBoundingClientRect(), origin)
            : { x: 0, y: 0 };
        }),
        time: performance.now(),
        velocity: { x: 0, y: 0 },
      };
      setSettling(null);
      setDrag({ from, over: from, tileId });

      const move = (moveEvent: PointerEvent) => {
        const { current } = track;
        if (!current) {
          return;
        }
        const next = local(moveEvent);
        const now = performance.now();
        const elapsed = Math.max(1, now - current.time);
        current.velocity = {
          x: ((next.x - current.pointer.x) / elapsed) * 1000,
          y: ((next.y - current.pointer.y) / elapsed) * 1000,
        };
        current.pointer = next;
        current.time = now;
        const over = nearestSlot(current.slots, next);
        setDrag((state) =>
          state && state.over !== over ? { ...state, over } : state
        );
        followPointer(tileId);
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        const { current } = track;
        const to = current
          ? nearestSlot(
              current.slots,
              projectPoint(current.pointer, current.velocity)
            )
          : from;
        setDrag(null);
        setSettling(tileId);
        if (to !== from) {
          onDrop(from, to);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [followPointer, gridRef, local, onDrop, tileIds]
  );

  return { drag, settling, start, x, y };
};
