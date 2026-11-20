import { describeSqlAssumptions } from "@oh-my-query/core";
import { describe, expect, it } from "vitest";

import {
  QUARTERLY_REVENUE,
  REGION_REVENUE,
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
} from "@/lib/browser-ask-recordings";

import {
  RECORDED_ASSUMPTIONS,
  recordedAssumptions,
  refinedRecording,
} from "./browser-refine-stub";

const REFINE = {
  chainId: "ask-1",
  spec: REVENUE_BY_REGION.spec,
  sql: REVENUE_BY_REGION.sql,
  turns: ["Revenue by region"],
};

describe("recorded assumptions", () => {
  it.each([...RECORDED_ASSUMPTIONS])(
    "match what core describes for each recorded SQL",
    (sql, recorded) => {
      expect(describeSqlAssumptions(sql, "postgresql")).toStrictEqual(recorded);
    }
  );

  it("returns null for SQL with no recording", () => {
    expect(recordedAssumptions("select 1")).toBeNull();
  });
});

describe("refinedRecording", () => {
  it.each([
    ["only Europe", REGION_REVENUE],
    ['break down region "Europe"', REGION_REVENUE],
    ["by quarter", QUARTERLY_REVENUE],
  ])("replays %s", (prompt, recording) => {
    expect(refinedRecording(REFINE, prompt)).toBe(recording);
  });

  it("re-emits the base answer with a new subtitle otherwise", () => {
    const refined = refinedRecording(
      { ...REFINE, spec: WEEKLY_SIGNUPS.spec, sql: WEEKLY_SIGNUPS.sql },
      "as a stacked bar"
    );
    expect(refined.rows).toBe(WEEKLY_SIGNUPS.rows);
    expect(refined.spec.subtitle).toBe("Refined: as a stacked bar");
  });

  it("falls back to the base card for SQL it has not recorded", () => {
    const refined = refinedRecording(
      { ...REFINE, sql: "select 1 as n" },
      "sorted"
    );
    expect(refined.sql).toBe("select 1 as n");
    expect(refined.spec.title).toBe(REVENUE_BY_REGION.spec.title);
  });
});
