import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDateLabel,
  isKnownDialect,
  KNOWN_DIALECTS,
  normalizeSql,
} from "@/lib/history-shared";

describe("isKnownDialect", () => {
  it("accepts every known dialect", () => {
    for (const dialect of KNOWN_DIALECTS) {
      expect(isKnownDialect(dialect)).toBeTruthy();
    }
  });

  it("rejects unknown strings", () => {
    expect(isKnownDialect("oracle")).toBeFalsy();
    expect(isKnownDialect("")).toBeFalsy();
  });

  it("rejects null and undefined", () => {
    const missing: string | null | undefined = undefined;
    expect(isKnownDialect(null)).toBeFalsy();
    expect(isKnownDialect(missing)).toBeFalsy();
  });
});

describe("normalizeSql", () => {
  it("collapses runs of whitespace into single spaces", () => {
    expect(normalizeSql("select   *\n  from\tusers")).toBe(
      "select * from users"
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeSql("   select 1   ")).toBe("select 1");
  });

  it("preserves single internal spaces", () => {
    expect(normalizeSql("select 1")).toBe("select 1");
  });
});

describe("getDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Today' for a timestamp earlier the same day", () => {
    expect(getDateLabel("2026-05-01T03:14:00Z")).toBe("Today");
  });

  it("returns 'Yesterday' for the previous day", () => {
    expect(getDateLabel("2026-04-30T22:00:00Z")).toBe("Yesterday");
  });

  it("formats older dates as 'MMM d, yyyy'", () => {
    expect(getDateLabel("2026-03-15T10:00:00Z")).toBe("Mar 15, 2026");
  });

  it("returns 'Unknown date' when the input is not parseable", () => {
    expect(getDateLabel("not-a-date")).toBe("Unknown date");
  });
});
