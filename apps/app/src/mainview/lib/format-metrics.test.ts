import { describe, expect, it } from "vitest";

import { formatCount, formatDuration } from "@/lib/format-metrics";

describe("formatCount", () => {
  it("adds thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });
});

describe("formatDuration", () => {
  it("renders values under 1s in ms", () => {
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(999)).toBe("999 ms");
  });

  it("renders single-digit seconds with one decimal", () => {
    expect(formatDuration(1500)).toBe("1.5 s");
    expect(formatDuration(9900)).toBe("9.9 s");
  });

  it("renders two-digit seconds without decimals", () => {
    expect(formatDuration(10_000)).toBe("10 s");
    expect(formatDuration(59_999)).toBe("59 s");
  });

  it("renders minutes plus remainder", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(75_000)).toBe("1m 15s");
    expect(formatDuration(3_600_000)).toBe("60m 0s");
  });
});
