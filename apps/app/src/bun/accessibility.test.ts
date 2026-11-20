import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessibilityProbe } from "./accessibility.ts";

import {
  requireAccessibility,
  TRUST_POLL_MS,
  TRUST_WAIT_MS,
} from "./accessibility.ts";

const probeOf = (
  trusted: boolean[]
): AccessibilityProbe & {
  prompt: ReturnType<typeof vi.fn>;
} => {
  const answers = [...trusted];
  return {
    isTrusted: () => answers.shift() ?? false,
    prompt: vi.fn().mockReturnValue(false),
  };
};

describe("requireAccessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockReturnValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing when the app is already trusted", () => {
    const probe = probeOf([true]);
    const onTrusted = vi.fn();
    requireAccessibility(probe, onTrusted);
    vi.advanceTimersByTime(TRUST_POLL_MS * 3);
    expect(probe.prompt).not.toHaveBeenCalled();
    expect(onTrusted).not.toHaveBeenCalled();
  });

  it("prompts once and reports the grant when it arrives", () => {
    const probe = probeOf([false, false, true]);
    const onTrusted = vi.fn();
    requireAccessibility(probe, onTrusted);
    expect(probe.prompt).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(TRUST_POLL_MS);
    expect(onTrusted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TRUST_POLL_MS * 3);
    expect(onTrusted).toHaveBeenCalledOnce();
  });

  it("stops waiting after the deadline or when cancelled", () => {
    const probe = probeOf([]);
    const onTrusted = vi.fn();
    const cancel = requireAccessibility(probe, onTrusted);
    vi.advanceTimersByTime(TRUST_WAIT_MS + TRUST_POLL_MS * 2);
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    expect(onTrusted).not.toHaveBeenCalled();
  });
});
