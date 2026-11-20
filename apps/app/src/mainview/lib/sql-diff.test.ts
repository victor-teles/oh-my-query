import { describe, expect, it } from "vitest";

import { changedLines } from "./sql-diff";

const BASE = `select month, region, mrr
from mrr
where year = 2026
order by month`;

describe("changedLines", () => {
  it("marks nothing when the SQL is unchanged", () => {
    expect([...changedLines(BASE, BASE)]).toStrictEqual([]);
  });

  it("marks an added filter line", () => {
    const next = BASE.replace(
      "where year = 2026",
      "where year = 2026\n  and region = 'Europe'"
    );
    expect([...changedLines(BASE, next)]).toStrictEqual([3]);
  });

  it("marks a rewritten line and ignores indentation changes", () => {
    const next = `select quarter, region, mrr
  from mrr
where year = 2026
order by quarter`;
    expect([...changedLines(BASE, next)]).toStrictEqual([0, 3]);
  });

  it("marks every line of a first answer", () => {
    expect([...changedLines("", "select 1\nfrom t")]).toStrictEqual([0, 1]);
  });

  it("marks nothing for an empty next SQL", () => {
    expect([...changedLines(BASE, "")]).toStrictEqual([]);
  });
});
