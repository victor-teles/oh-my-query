import { describe, expect, it } from "vitest";

import type { TemplateValue } from "./sql-template.ts";

import {
  compileSqlTemplate,
  maskTemplateInputs,
  resolveDatePreset,
  resolvePreset,
  templateInputNames,
  tokenizeSqlTemplate,
} from "./sql-template.ts";

const period: TemplateValue = {
  from: "2026-07-01",
  kind: "dateRange",
  to: "2026-10-01",
};
const region: TemplateValue = { kind: "text", value: "Europe" };
const limit: TemplateValue = { kind: "number", value: 10 };

const TEMPLATE = `select region, sum(mrr) from revenue
where billed_at >= {{period.from}}::date and billed_at < {{period.to}}::date
  and region = {{region}} or parent_region = {{region}}
limit {{limit}}`;

const VALUES = { limit, period, region };

describe("compileSqlTemplate", () => {
  it("numbers postgres markers and reuses an index for a repeated input", () => {
    const { sql, params } = compileSqlTemplate(TEMPLATE, VALUES, "postgresql");
    expect(sql).toContain(">= $1::date and billed_at < $2::date");
    expect(sql).toContain("region = $3 or parent_region = $3");
    expect(sql).toContain("limit $4");
    expect(params).toStrictEqual(["2026-07-01", "2026-10-01", "Europe", 10]);
  });

  it.each(["mysql", "sqlite", "duckdb"] as const)(
    "pushes a repeated value again for %s question marks",
    (dialect) => {
      const template = TEMPLATE.replaceAll("::date", "");
      const { sql, params } = compileSqlTemplate(template, VALUES, dialect);
      expect(sql.match(/\?/g)).toHaveLength(5);
      expect(params).toStrictEqual([
        "2026-07-01",
        "2026-10-01",
        "Europe",
        "Europe",
        10,
      ]);
    }
  );

  it("names tsql markers @pN and reuses them", () => {
    const template = TEMPLATE.replaceAll("::date", "");
    const { sql, params } = compileSqlTemplate(template, VALUES, "tsql");
    expect(sql).toContain("region = @p3 or parent_region = @p3");
    expect(params).toHaveLength(4);
  });

  it("types clickhouse markers from the input kind", () => {
    const template = TEMPLATE.replaceAll("::date", "");
    const { sql } = compileSqlTemplate(template, VALUES, "clickhouse");
    expect(sql).toContain(">= {p1:Date} and billed_at < {p2:Date}");
    expect(sql).toContain(
      "region = {p3:String} or parent_region = {p3:String}"
    );
    expect(sql).toContain("limit {p4:Float64}");
  });

  it("never copies a value into the SQL text", () => {
    const hostile: TemplateValue = {
      kind: "text",
      value: "x'; drop table users; --",
    };
    const { sql, params } = compileSqlTemplate(
      "select * from t where name = {{name}}",
      { name: hostile },
      "postgresql"
    );
    expect(sql).toBe("select * from t where name = $1");
    expect(params).toStrictEqual(["x'; drop table users; --"]);
  });

  it("accepts spacing inside the braces", () => {
    const { sql } = compileSqlTemplate(
      "select {{ n }}",
      { n: limit },
      "postgresql"
    );
    expect(sql).toBe("select $1");
  });

  it("leaves braces inside literals and comments alone when they aren't inputs", () => {
    const { sql } = compileSqlTemplate(
      "select '{}' as j, \"{x}\" -- { not an input }\nfrom t",
      {},
      "postgresql"
    );
    expect(sql).toBe("select '{}' as j, \"{x}\" -- { not an input }\nfrom t");
  });

  it.each([
    ["a quoted string", "select '{{region}}'"],
    ["a line comment", "select 1 -- {{region}}"],
    ["a block comment", "select 1 /* {{region}} */"],
    ["a dollar-quoted string", "select $$ {{region}} $$"],
    ["a quoted identifier", 'select "{{region}}"'],
  ])("rejects an input inside %s", (_label, template) => {
    expect(() =>
      compileSqlTemplate(template, { region }, "postgresql")
    ).toThrow(/inside a quoted string or a comment/);
  });

  it("rejects an unknown input", () => {
    expect(() =>
      compileSqlTemplate("select {{missing}}", {}, "postgresql")
    ).toThrow(/Unknown input "missing"/);
  });

  it("rejects an unused input", () => {
    expect(() =>
      compileSqlTemplate("select {{region}}", { limit, region }, "postgresql")
    ).toThrow(/Unused input: limit/);
  });

  it("requires .from or .to on a date range", () => {
    expect(() =>
      compileSqlTemplate("select {{period}}", { period }, "postgresql")
    ).toThrow(/period.from/);
  });

  it("rejects .from on an input that isn't a range", () => {
    expect(() =>
      compileSqlTemplate("select {{region.from}}", { region }, "postgresql")
    ).toThrow(/Only date ranges/);
  });

  it("rejects a malformed placeholder", () => {
    expect(() =>
      compileSqlTemplate("select {{Region}}", {}, "postgresql")
    ).toThrow(/Malformed input/);
  });

  it("rejects an unterminated string", () => {
    expect(() => compileSqlTemplate("select 'open", {}, "postgresql")).toThrow(
      /unterminated/
    );
  });

  it.each([
    ["postgresql", "select $1"],
    ["mysql", "select ?"],
    ["sqlite", "select :name"],
    ["tsql", "select @p1"],
    ["clickhouse", "select {x:String}"],
  ] as const)("rejects a bare %s bind marker", (dialect, template) => {
    expect(() => compileSqlTemplate(template, {}, dialect)).toThrow(
      /bind marker/
    );
  });

  it("refuses inputs on a dialect without a driver", () => {
    expect(() =>
      compileSqlTemplate("select {{limit}}", { limit }, "oracle")
    ).toThrow(/aren't supported/);
  });

  it("reads mysql backslash escapes so a quote can't end the string early", () => {
    expect(() =>
      compileSqlTemplate(
        String.raw`select 'it\'s {{region}}'`,
        { region },
        "mysql"
      )
    ).toThrow(/inside a quoted string/);
  });

  it("reads tsql bracket identifiers as quoted", () => {
    expect(() =>
      compileSqlTemplate("select [{{region}}] from t", { region }, "tsql")
    ).toThrow(/inside a quoted string/);
    expect(compileSqlTemplate("select [region] from t", {}, "tsql").sql).toBe(
      "select [region] from t"
    );
  });
});

describe("template helpers", () => {
  it("lists each input name once", () => {
    expect(templateInputNames(TEMPLATE, "postgresql")).toStrictEqual([
      "period",
      "region",
      "limit",
    ]);
  });

  it("masks inputs for the read-only guard", () => {
    expect(
      maskTemplateInputs("select {{a}} + {{b.from}}", "postgresql", "NULL")
    ).toBe("select NULL + NULL");
  });

  it("splits a template into code, literal, comment and input segments", () => {
    const kinds = tokenizeSqlTemplate(
      "select 'a' -- c\n, {{n}}",
      "postgresql"
    ).map((segment) => segment.kind);
    expect(kinds).toStrictEqual([
      "code",
      "literal",
      "code",
      "comment",
      "code",
      "placeholder",
    ]);
  });
});

const at = (iso: string): Date => {
  const [date = "", time = "12:00"] = iso.split(" ");
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

describe("resolvePreset", () => {
  it.each([
    ["last7d", "2026-03-04", { from: "2026-02-26", to: "2026-03-05" }],
    ["last30d", "2026-03-04", { from: "2026-02-03", to: "2026-03-05" }],
    ["thisMonth", "2026-12-15", { from: "2026-12-01", to: "2027-01-01" }],
    ["lastMonth", "2026-01-15", { from: "2025-12-01", to: "2026-01-01" }],
    ["thisQuarter", "2026-11-18", { from: "2026-10-01", to: "2027-01-01" }],
    ["lastQuarter", "2026-02-10", { from: "2025-10-01", to: "2026-01-01" }],
    ["thisQuarter", "2026-03-31", { from: "2026-01-01", to: "2026-04-01" }],
    ["ytd", "2026-11-18", { from: "2026-01-01", to: "2026-11-19" }],
    ["ytd", "2026-12-31", { from: "2026-01-01", to: "2027-01-01" }],
    ["last12m", "2026-11-18", { from: "2025-12-01", to: "2026-12-01" }],
    ["last12m", "2026-01-05", { from: "2025-02-01", to: "2026-02-01" }],
  ] as const)("%s on %s", (preset, today, expected) => {
    expect(resolvePreset(preset, at(today))).toStrictEqual(expected);
  });

  it("counts calendar days across a DST change, not 24-hour blocks", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(resolvePreset("last7d", at("2026-03-10 00:30"))).toStrictEqual({
        from: "2026-03-04",
        to: "2026-03-11",
      });
      expect(resolvePreset("last7d", at("2026-11-03 23:30"))).toStrictEqual({
        from: "2026-10-28",
        to: "2026-11-04",
      });
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("resolveDatePreset", () => {
  const wednesday = at("2026-11-18");

  it.each([
    ["today", "2026-11-18"],
    ["yesterday", "2026-11-17"],
    ["startOfWeek", "2026-11-16"],
    ["startOfMonth", "2026-11-01"],
    ["startOfQuarter", "2026-10-01"],
    ["startOfYear", "2026-01-01"],
  ] as const)("%s", (preset, expected) => {
    expect(resolveDatePreset(preset, wednesday)).toBe(expected);
  });

  it("honours a Sunday week start", () => {
    expect(resolveDatePreset("startOfWeek", wednesday, 0)).toBe("2026-11-15");
  });

  it("crosses a year boundary for yesterday", () => {
    expect(resolveDatePreset("yesterday", at("2026-01-01"))).toBe("2025-12-31");
  });
});
