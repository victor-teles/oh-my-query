import { describe, expect, it } from "vitest";

import { generalizeKey, groupKeyPatterns } from "./key-patterns.ts";

describe("generalizeKey", () => {
  it.each([
    ["session:3f2a9c1e7b4d4a10b2c9", "session:*"],
    ["session:3f2a6b1c-1d2e-4f50-8a9b-0c1d2e3f4a5b", "session:*"],
    ["user:42:cart", "user:*:cart"],
    ["rate:alice@example.com", "rate:*"],
    ["stats:signups:2026-11-20", "stats:signups:*"],
    ["events:2026-11-20T10.00.00Z", "events:*"],
    ["token:dGhpc0lzQVRva2VuVmFsdWU=", "token:*"],
    ["cache:Ab12Cd34Ef56Gh78Ij", "cache:*"],
    ["leaderboard", "leaderboard"],
    ["feature:notificationsettings", "feature:notificationsettings"],
    ["price:-3.5", "price:*"],
  ])("generalises %s to %s", (key, pattern) => {
    expect(generalizeKey(key)).toBe(pattern);
  });
});

describe("groupKeyPatterns", () => {
  it("collapses keys into patterns, most frequent first", () => {
    expect(
      groupKeyPatterns([
        "user:1:cart",
        "session:abcdef123456",
        "user:2:cart",
        "user:3:cart",
        "session:abcdef654321",
        "leaderboard",
      ])
    ).toStrictEqual([
      { count: 3, pattern: "user:*:cart", sample: "user:1:cart" },
      { count: 2, pattern: "session:*", sample: "session:abcdef123456" },
      { count: 1, pattern: "leaderboard", sample: "leaderboard" },
    ]);
  });

  it("returns nothing for no keys", () => {
    expect(groupKeyPatterns([])).toStrictEqual([]);
  });
});
