import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { proposeParams, sqlShape } from "./propose-params.ts";

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 10,
    total: 10,
  },
  outputTokens: { reasoning: undefined, text: 10, total: 10 },
};
const finishReason = { raw: undefined, unified: "stop" as const };

const replyWith = (draft: unknown) =>
  new MockLanguageModelV3({
    doGenerate: {
      content: [{ text: JSON.stringify(draft), type: "text" }],
      finishReason,
      usage,
      warnings: [],
    },
  });

const SQL = `-- Revenue by region
select r.name as region, sum(s.amount) as revenue
from subscriptions s join regions r on r.id = s.region_id
where s.billed_at >= date '2026-07-01' and s.billed_at < date '2026-10-01'
  and r.name = 'Europe'
group by 1
limit 500`;

const TEMPLATE = `-- Revenue by region
select r.name as region, sum(s.amount) as revenue
from subscriptions s join regions r on r.id = s.region_id
where s.billed_at >= {{period.from}}::date and s.billed_at < {{period.to}}::date
  and r.name = {{region}}
group by 1
limit {{row_limit}}`;

const input = (overrides: Record<string, unknown> = {}) => ({
  defaultValue: "",
  label: "Input",
  max: null,
  min: null,
  name: "input",
  options: null,
  optionsSql: null,
  type: "text",
  ...overrides,
});

const PERIOD = input({
  defaultValue: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
});
const REGION = input({
  defaultValue: "Europe",
  label: "Region",
  name: "region",
  optionsSql: "select distinct name from regions order by 1 limit 200",
  type: "select",
});
const ROW_LIMIT = input({
  defaultValue: "500",
  label: "Rows",
  max: 2000,
  min: 1,
  name: "row_limit",
  type: "number",
});

const run = (draft: unknown, sql = SQL) =>
  proposeParams({
    dialect: "postgresql",
    model: replyWith(draft),
    now: new Date(2026, 10, 18),
    prompt: "revenue by region last quarter",
    signal: new AbortController().signal,
    sql,
  });

describe("proposeParams", () => {
  it("accepts a template that only lifts literals", async () => {
    const result = await run({
      inputs: [PERIOD, REGION, ROW_LIMIT],
      template: TEMPLATE,
    });
    expect(result).toStrictEqual({
      params: [
        {
          default: "lastQuarter",
          label: "Period",
          name: "period",
          type: "dateRange",
        },
        {
          default: "Europe",
          label: "Region",
          name: "region",
          optionsSql: "select distinct name from regions order by 1 limit 200",
          type: "select",
        },
        {
          default: 500,
          label: "Rows",
          max: 2000,
          min: 1,
          name: "row_limit",
          type: "number",
        },
      ],
      template: TEMPLATE,
    });
  });

  it("accepts a custom range default", async () => {
    const result = await run({
      inputs: [{ ...PERIOD, defaultValue: "2026-07-01..2026-10-01" }],
      template: SQL.replace(
        "date '2026-07-01'",
        "{{period.from}}::date"
      ).replace("date '2026-10-01'", "{{period.to}}::date"),
    });
    expect(result).toMatchObject({
      params: [{ default: { from: "2026-07-01", to: "2026-10-01" } }],
    });
  });

  it("returns the query unchanged when nothing is worth lifting", async () => {
    await expect(run({ inputs: [], template: SQL })).resolves.toStrictEqual({
      params: [],
      template: SQL,
    });
  });

  it("rejects a declared input the template never uses", async () => {
    const result = await run({
      inputs: [PERIOD, REGION, ROW_LIMIT, input({ name: "unused" })],
      template: TEMPLATE,
    });
    expect(result).toStrictEqual({ error: "Unused input: unused." });
  });

  it("rejects a template that changes more than literals", async () => {
    const result = await run({
      inputs: [PERIOD, REGION, ROW_LIMIT],
      template: TEMPLATE.replace("sum(s.amount)", "max(s.amount)"),
    });
    expect(result).toStrictEqual({
      error: "The template changes more than literal values.",
    });
  });

  it("rejects an input that replaces a column name", async () => {
    const result = await run({
      inputs: [input({ defaultValue: "region_id", name: "column_name" })],
      template: SQL.replace("s.region_id", "{{column_name}}"),
    });
    expect(result).toStrictEqual({
      error: "The template changes more than literal values.",
    });
  });

  it("rejects an input placed inside quotes", async () => {
    const result = await run({
      inputs: [REGION],
      template: SQL.replace("'Europe'", "'{{region}}'"),
    });
    expect(result).toMatchObject({ error: expect.stringMatching(/quoted/) });
  });

  it("rejects options SQL that writes", async () => {
    const result = await run({
      inputs: [{ ...REGION, optionsSql: "delete from regions" }],
      template: SQL.replace("'Europe'", "{{region}}"),
    });
    expect(result).toMatchObject({
      error: expect.stringMatching(/Options for Region isn't read-only/),
    });
  });

  it("rejects more than four inputs", async () => {
    const extra = (name: string) =>
      input({ defaultValue: "1", name, type: "number" });
    const result = await run(
      {
        inputs: ["a", "b", "c", "d", "e"].map(extra),
        template: "select {{a}} + {{b}} + {{c}} + {{d}} + {{e}}",
      },
      "select 1 + 1 + 1 + 1 + 1"
    );
    expect(result).toStrictEqual({ error: "Proposed 5 inputs; at most 4." });
  });

  it("rejects an invalid input definition", async () => {
    const result = await run({
      inputs: [{ ...ROW_LIMIT, defaultValue: "lots" }],
      template: TEMPLATE,
    });
    expect(result).toMatchObject({
      error: expect.stringMatching(/"row_limit" isn't valid/),
    });
  });

  it("turns a select without options into a text input", async () => {
    const result = await run({
      inputs: [{ ...REGION, optionsSql: null }],
      template: SQL.replace("'Europe'", "{{region}}"),
    });
    expect(result).toMatchObject({ params: [{ type: "text" }] });
  });

  it("restores a default the model got wrong from the literal it replaced", async () => {
    const result = await run({
      inputs: [{ ...ROW_LIMIT, defaultValue: "50" }, PERIOD, REGION],
      template: TEMPLATE,
    });
    expect(result).toMatchObject({
      params: [{ default: 500, name: "row_limit" }, {}, { default: "Europe" }],
    });
  });

  it("asks once more with the rejection reason and accepts the fix", async () => {
    const replies = [
      {
        inputs: [PERIOD, REGION, ROW_LIMIT, input({ name: "extra" })],
        template: TEMPLATE,
      },
      { inputs: [PERIOD, REGION, ROW_LIMIT], template: TEMPLATE },
    ];
    const model = new MockLanguageModelV3({
      doGenerate: vi.fn().mockImplementation(() => {
        const draft = replies.shift();
        return Promise.resolve({
          content: [{ text: JSON.stringify(draft), type: "text" }],
          finishReason,
          usage,
          warnings: [],
        });
      }),
    });
    const result = await proposeParams({
      dialect: "postgresql",
      model,
      now: new Date(2026, 10, 18),
      prompt: "revenue",
      signal: new AbortController().signal,
      sql: SQL,
    });
    expect(result).toMatchObject({ template: TEMPLATE });
    const retry = JSON.stringify(model.doGenerateCalls[1]?.prompt);
    expect(retry).toContain("Unused input: extra.");
  });

  it("reports a model failure as an error", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: vi.fn().mockRejectedValue(new Error("fetch failed")),
    });
    const result = await proposeParams({
      dialect: "postgresql",
      model,
      now: new Date(),
      prompt: "q",
      signal: new AbortController().signal,
      sql: SQL,
    });
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("sqlShape", () => {
  it.each([
    ["date '2026-01-01'", "{{d}}::date"],
    ["date '2026-01-01'", "cast({{d}} as date)"],
    ["'2026-01-01'::timestamp", "{{d}}"],
    ["interval '7 days'", "{{d}}::interval"],
    ["500", "{{n}}"],
    ["1.5e3", "{{n}}"],
  ])("treats %s and %s as the same shape", (literal, input) => {
    expect(sqlShape(`select * from t where x > ${literal}`, "postgresql")).toBe(
      sqlShape(`select * from t where x > ${input}`, "postgresql")
    );
  });

  it("ignores comments, case and whitespace", () => {
    expect(sqlShape("-- note\nSELECT  a\nFROM t", "postgresql")).toBe(
      sqlShape("select a from t", "postgresql")
    );
  });

  it("keeps identifiers with digits", () => {
    expect(sqlShape("select t1.a from t1", "postgresql")).toBe(
      "select t1.a from t1"
    );
  });

  it("keeps quoted identifiers", () => {
    expect(sqlShape('select "Region" from t', "postgresql")).not.toBe(
      sqlShape("select ? from t", "postgresql")
    );
  });
});
