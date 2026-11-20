import { describe, expect, it } from "vitest";

import type { SqlAssumption } from "./sql-assumptions.ts";
import type { DialectType } from "./types.ts";

import { describeSqlAssumptions } from "./sql-assumptions.ts";

interface DialectCase {
  dialect: DialectType;
  sql: string;
  items: SqlAssumption[];
}

const DIALECT_CASES: DialectCase[] = [
  {
    dialect: "postgresql",
    items: [
      { kind: "table", name: "orders" },
      { column: "orders.created_at", grain: "month", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "o.created_at >= CAST('2026-01-01' AS DATE)",
      },
      {
        column: "status",
        kind: "filter",
        text: "o.status IN ('paid', 'pending')",
      },
      { kind: "limit", rows: 500 },
    ],
    sql: `-- Orders by month
select date_trunc('month', o.created_at)::date as month, count(*) as orders
from public.orders o
where o.created_at >= date '2026-01-01'
  and o.status in ('paid', 'pending')
group by 1
order by 1
limit 500`,
  },
  {
    dialect: "mysql",
    items: [
      { kind: "table", name: "orders" },
      { column: "orders.created_at", grain: "month", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "o.created_at >= '2026-01-01'",
      },
      {
        column: "status",
        kind: "filter",
        text: "o.status IN ('paid', 'pending')",
      },
      { kind: "limit", rows: 100 },
    ],
    sql: "select DATE_FORMAT(o.created_at, '%Y-%m') as month, count(*) as orders from orders o where o.created_at >= '2026-01-01' and o.status in ('paid', 'pending') group by 1 limit 100",
  },
  {
    dialect: "sqlite",
    items: [
      { kind: "table", name: "orders" },
      { column: "created_at", grain: "day", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "created_at >= DATE('now', '-7 days')",
      },
      { column: "status", kind: "filter", text: "status IN ('paid')" },
      { kind: "limit", rows: 10 },
    ],
    sql: "select strftime('%Y-%m-%d', created_at) as day, count(*) as orders from orders where created_at >= date('now', '-7 days') and status in ('paid') group by 1 limit 10",
  },
  {
    dialect: "tsql",
    items: [
      { kind: "table", name: "orders" },
      { column: "orders.created_at", grain: "week", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "o.created_at >= '2026-01-01'",
      },
      {
        column: "status",
        kind: "filter",
        text: "o.status IN ('paid', 'pending')",
      },
      { kind: "limit", rows: 50 },
    ],
    sql: "select top 50 DATEPART(week, o.created_at) as wk, count(*) as n from dbo.orders o where o.created_at >= '2026-01-01' and o.status in ('paid', 'pending') group by DATEPART(week, o.created_at)",
  },
  {
    dialect: "clickhouse",
    items: [
      { kind: "table", name: "events" },
      { column: "created_at", grain: "month", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "created_at >= today() - 30",
      },
      { column: "kind", kind: "filter", text: "kind IN ('signup', 'login')" },
      { kind: "limit", rows: 20 },
    ],
    sql: "select toStartOfMonth(created_at) as month, count() as n from events where created_at >= today() - 30 and kind in ('signup', 'login') group by 1 limit 20",
  },
  {
    dialect: "duckdb",
    items: [
      { kind: "table", name: "orders" },
      { column: "orders.created_at", grain: "quarter", kind: "time" },
      {
        column: "created_at",
        kind: "filter",
        text: "o.created_at >= CAST('2026-01-01' AS DATE)",
      },
      {
        column: "status",
        kind: "filter",
        text: "o.status IN ('paid', 'pending')",
      },
      { kind: "limit", rows: 8 },
    ],
    sql: "select date_trunc('quarter', o.created_at) as quarter, count(*) as n from orders o where o.created_at >= date '2026-01-01' and o.status in ('paid', 'pending') group by 1 limit 8",
  },
];

describe("describeSqlAssumptions per dialect", () => {
  it.each(DIALECT_CASES)(
    "reads tables, time, filters and limit for $dialect",
    ({ dialect, sql, items }) => {
      expect(describeSqlAssumptions(sql, dialect)).toStrictEqual({ items });
    }
  );
});

describe("describeSqlAssumptions shapes", () => {
  it("reads filters from the single CTE the outer query reads", () => {
    const sql = `with paid as (
  select * from payments p where p.status <> 'refunded'
)
select date_trunc('month', paid.paid_at) as month, sum(amount) as total
from paid
join regions r on r.id = paid.region_id
group by 1`;
    expect(describeSqlAssumptions(sql, "postgresql")?.items).toStrictEqual([
      { kind: "table", name: "regions" },
      { kind: "table", name: "payments" },
      { column: "paid_at", grain: "month", kind: "time" },
      { column: "status", kind: "filter", text: "p.status <> 'refunded'" },
    ]);
  });

  it("skips join predicates in WHERE", () => {
    const sql =
      "select a.name, count(*) as n from accounts a, regions r where a.region_id = r.id and r.name = 'Europe' group by 1";
    expect(describeSqlAssumptions(sql, "postgresql")?.items).toStrictEqual([
      { kind: "table", name: "accounts" },
      { kind: "table", name: "regions" },
      { column: "name", kind: "filter", text: "r.name = 'Europe'" },
    ]);
  });

  it("uses a date range as the time column and drops it from filters", () => {
    const sql =
      "select count(*) as n from orders where created_at > now() - interval '7 days' and total > 10";
    expect(describeSqlAssumptions(sql, "postgresql")?.items).toStrictEqual([
      { kind: "table", name: "orders" },
      { column: "created_at", grain: null, kind: "time" },
      { column: "total", kind: "filter", text: "total > 10" },
    ]);
  });

  it("clips long filters at 60 characters", () => {
    const sql = `select id from orders where note in ('${"a".repeat(40)}', '${"b".repeat(40)}')`;
    expect(describeSqlAssumptions(sql, "postgresql")?.items[1]).toStrictEqual({
      column: "note",
      kind: "filter",
      text: `note IN ('${"a".repeat(40)}', '${"b".repeat(5)}…`,
    });
  });

  it("caps the line at eight items", () => {
    const filters = Array.from({ length: 6 }, (_, i) => `c${i} = ${i}`).join(
      " and "
    );
    const sql = `select a.x from t1 a join t2 b on a.id = b.id join t3 c on c.id = a.id join t4 d on d.id = a.id join t5 e on e.id = a.id where ${filters} limit 5`;
    const items = describeSqlAssumptions(sql, "postgresql")?.items;
    expect(items).toHaveLength(8);
    expect(items?.filter((item) => item.kind === "table")).toHaveLength(4);
  });

  it.each([
    ["an unparsable statement", "selec nope frm"],
    ["a write", "insert into t values (1)"],
    ["two statements", "select 1; select 2"],
  ])("returns null for %s", (_label, sql) => {
    expect(describeSqlAssumptions(sql, "postgresql")).toBeNull();
  });

  it("returns null for a dialect polyglot does not know", () => {
    expect(
      describeSqlAssumptions("select 1", "mongodb" as DialectType)
    ).toBeNull();
  });
});
