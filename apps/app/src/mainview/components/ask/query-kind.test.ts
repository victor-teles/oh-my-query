import { describe, expect, it } from "vitest";

import { offendingKeyword } from "./ask-error";
import { queryKindOf } from "./query-kind";

describe("queryKindOf", () => {
  it.each([
    [null, "postgresql", "sql"],
    [null, "mongodb", "mongodb"],
    [null, "redis", "redis"],
    [null, undefined, "sql"],
    ["mongodb", "postgresql", "mongodb"],
    ["redis", undefined, "redis"],
    ["duckdb", "redis", "sql"],
  ] as const)(
    "reads language %s on a %s connection as %s",
    (language, type, kind) => {
      expect(queryKindOf(language, type)).toBe(kind);
    }
  );
});

const refusal = (message: string) => ({
  code: "NOT_READ_ONLY" as const,
  message,
  phase: "sql" as const,
});

describe("offendingKeyword", () => {
  it.each([
    ["$merge writes data; only read-only pipelines can run here.", "$merge"],
    ["SET writes data; only read commands can run here.", "SET"],
    ["ZRANGE STORE writes data; only read commands can run here.", "ZRANGE"],
    ["Only read-only queries can run here, not DELETE.", "DELETE"],
    ["Only MEMORY USAGE <key> can run here.", "MEMORY"],
    ["Each pipeline stage must have exactly one operator.", null],
  ])("finds the token in %s", (message, token) => {
    expect(offendingKeyword(refusal(message))).toBe(token);
  });

  it("marks nothing for other failures", () => {
    expect(
      offendingKeyword({
        code: "QUERY_FAILED",
        message: "SET failed",
        phase: "run",
      })
    ).toBeNull();
  });
});
