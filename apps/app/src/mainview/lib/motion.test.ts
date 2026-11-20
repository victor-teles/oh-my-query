import { describe, expect, it } from "vitest";

import {
  FADE_IN,
  FADE_OUT,
  motionPreset,
  PRESS_SCALE,
  readSlowMotionFactor,
  REDUCED_FADE,
  REDUCED_PRESS_OPACITY,
  scaleTransition,
  SPRING,
  SPRING_SNAPPY,
  SPRING_SOFT,
  staggerDelay,
} from "./motion";

const dampingRatio = (spring: typeof SPRING) =>
  spring.damping / (2 * Math.sqrt(spring.stiffness));

describe("motion tokens", () => {
  it("keeps the repository spring standard", () => {
    expect(SPRING).toStrictEqual({
      damping: 30,
      stiffness: 400,
      type: "spring",
    });
  });

  it("makes snappy and soft springs roughly critically damped", () => {
    for (const spring of [SPRING_SNAPPY, SPRING_SOFT]) {
      expect(dampingRatio(spring)).toBeGreaterThan(0.95);
      expect(dampingRatio(spring)).toBeLessThan(1.05);
    }
  });

  it("exits faster than it enters", () => {
    expect(FADE_OUT.duration).toBeLessThan(FADE_IN.duration);
  });

  it("caps stagger at six items", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2)).toBeCloseTo(0.06);
    expect(staggerDelay(40)).toBeCloseTo(staggerDelay(5));
  });
});

describe("motionPreset", () => {
  it("returns springs and a scale press when motion is allowed", () => {
    const preset = motionPreset(false);
    expect(preset.reduced).toBeFalsy();
    expect(preset.spring).toBe(SPRING);
    expect(preset.pressed).toStrictEqual({ scale: PRESS_SCALE });
  });

  it("replaces every spring with a short crossfade under reduced motion", () => {
    const preset = motionPreset(true);
    expect(preset.reduced).toBeTruthy();
    for (const transition of [preset.spring, preset.snappy, preset.soft]) {
      expect(transition).toBe(REDUCED_FADE);
    }
    expect(preset.pressed).toStrictEqual({ opacity: REDUCED_PRESS_OPACITY });
  });
});

describe("readSlowMotionFactor", () => {
  it("is a no-op outside development builds", () => {
    expect(
      readSlowMotionFactor({ isDev: false, search: "?slowmo=4", stored: "4" })
    ).toBe(1);
  });

  it("reads the query string first, then storage", () => {
    expect(
      readSlowMotionFactor({ isDev: true, search: "?slowmo=4", stored: "2" })
    ).toBe(4);
    expect(readSlowMotionFactor({ isDev: true, search: "", stored: "2" })).toBe(
      2
    );
  });

  it("ignores invalid factors", () => {
    expect(
      readSlowMotionFactor({ isDev: true, search: "?slowmo=0", stored: "abc" })
    ).toBe(1);
  });
});

describe("scaleTransition", () => {
  it("stretches tweens by the factor", () => {
    expect(scaleTransition(FADE_IN, 4).duration).toBeCloseTo(0.64);
  });

  it("keeps the spring damping ratio while slowing it down", () => {
    const slow = scaleTransition(SPRING, 4);
    expect(slow.stiffness).toBeCloseTo(25);
    expect(dampingRatio(slow)).toBeCloseTo(dampingRatio(SPRING));
  });

  it("returns the same object when the factor is 1", () => {
    expect(scaleTransition(SPRING, 1)).toBe(SPRING);
  });
});
