import { describe, expect, it } from "vitest";

import { trailCrumbs } from "./ask-trail";

const labels = (crumbs: ReturnType<typeof trailCrumbs>): string[] =>
  crumbs.map((crumb) =>
    crumb.kind === "gap"
      ? `…(${crumb.hidden.join("|")})`
      : `${crumb.prompt}${crumb.pending ? "*" : ""}`
  );

describe("trailCrumbs", () => {
  it("shows every crumb of a short chain", () => {
    expect(labels(trailCrumbs(["MRR", "only Europe"], 1, null))).toStrictEqual([
      "MRR",
      "only Europe",
    ]);
  });

  it("marks the running follow-up as pending", () => {
    expect(labels(trailCrumbs(["MRR"], 0, "by quarter"))).toStrictEqual([
      "MRR",
      "by quarter*",
    ]);
  });

  it("folds the middle of a long chain into one gap", () => {
    expect(
      labels(trailCrumbs(["a", "b", "c", "d", "e", "f"], 5, null))
    ).toStrictEqual(["a", "…(b|c|d)", "e", "f"]);
  });

  it("keeps the shown crumb visible inside a long chain", () => {
    expect(
      labels(trailCrumbs(["a", "b", "c", "d", "e", "f"], 2, null))
    ).toStrictEqual(["a", "…(b)", "c", "…(d)", "e", "f"]);
  });
});
