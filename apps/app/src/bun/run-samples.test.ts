import { describe, expect, it } from "vitest";

import { rowsDigest, sampleOf, valuesKeyOf } from "./run-samples.ts";

const HEX16 = /^[0-9a-f]{16}$/;

describe("valuesKeyOf", () => {
  it("is a 16-hex key that ignores key order", () => {
    const key = valuesKeyOf({ period: "last30d", region: "Europe" });
    expect(key).toMatch(HEX16);
    expect(valuesKeyOf({ period: "last30d", region: "Europe" })).toBe(key);
  });

  it("sorts nested range keys and tells different values apart", () => {
    expect(
      valuesKeyOf({ period: { from: "2026-01-01", to: "2026-02-01" } })
    ).toBe(valuesKeyOf({ period: { from: "2026-01-01", to: "2026-02-01" } }));
    expect(valuesKeyOf({ period: "last30d" })).not.toBe(
      valuesKeyOf({ period: "last7d" })
    );
  });
});

describe("rowsDigest", () => {
  it("changes with the rows and tolerates bigints", () => {
    expect(rowsDigest([[1]])).toMatch(HEX16);
    expect(rowsDigest([[1]])).not.toBe(rowsDigest([[2]]));
    expect(rowsDigest([[10n]])).toBe(rowsDigest([["10"]]));
  });
});

describe("sampleOf", () => {
  it("records the scalar, row count and digest at the run time", () => {
    const at = new Date("2026-11-19T09:41:00.000Z");
    const result = {
      columns: [{ name: "mrr", typeName: "NUMERIC" }],
      isTruncated: false,
      rowCount: 1,
      rows: [["48200"]],
    };
    expect(
      sampleOf({ view: { kind: "kpi", value: "mrr" } }, result, at)
    ).toStrictEqual({
      at: at.toISOString(),
      digest: rowsDigest([["48200"]]),
      rowCount: 1,
      value: 48_200,
    });
    expect(
      sampleOf(
        { view: { kind: "table" } },
        { ...result, rowCount: 2, rows: [[1], [2]] },
        at
      ).value
    ).toBeNull();
  });
});
