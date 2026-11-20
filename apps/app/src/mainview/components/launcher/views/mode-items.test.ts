import type { TableItem } from "@oh-my-query/core/client";

import { describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";

import { makeConnection } from "@/test/connection-fixture";

import { modeView } from "./mode-items";

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const billing = makeConnection({ id: "billing", name: "billing" });
const cache = makeConnection({ id: "cache", name: "cache", type: "redis" });
const connections: DatabaseConnection[] = [analytics, billing, cache];

const orders: TableItem = {
  columns: [],
  foreignKeys: [],
  indexes: [],
  name: "orders",
  rowEstimate: 12,
};

const itemKinds = (result: ReturnType<typeof modeView>) =>
  result.sections.flatMap((section) => section.items.map((item) => item.kind));

describe("modeView", () => {
  it("offers one SQL row on the active connection", () => {
    const result = modeView({
      active: analytics,
      connections,
      input: { mode: "sql", sql: "select 1" },
      tables: [],
    });
    expect(result.sections).toMatchObject([
      {
        id: "sql",
        items: [{ connection: analytics, kind: "sql", sql: "select 1" }],
        label: "Run SQL",
      },
    ]);
    expect(result.note).toBeNull();
  });

  it("explains what to type when the SQL is empty", () => {
    expect(
      modeView({
        active: analytics,
        connections,
        input: { mode: "sql", sql: "" },
        tables: [],
      })
    ).toStrictEqual({
      note: {
        text: "Type a read-only query. ↵ runs it on analytics.",
        tone: "hint",
      },
      sections: [],
    });
  });

  it.each([
    [{ mode: "sql", sql: "select 1" }, "Pick a connection to run SQL"],
    [{ mode: "table", needle: "" }, "Pick a connection to browse tables"],
  ] as const)("asks for a connection in %o", (input, label) => {
    const result = modeView({ active: null, connections, input, tables: [] });
    expect(result.sections[0]?.label).toBe(label);
    expect(itemKinds(result)).toStrictEqual([
      "connection",
      "connection",
      "connection",
    ]);
  });

  it("asks for a connection to exist first", () => {
    expect(
      modeView({
        active: null,
        connections: [],
        input: { mode: "sql", sql: "x" },
        tables: [],
      }).note
    ).toStrictEqual({ text: "Add a connection first.", tone: "hint" });
  });

  it.each([
    [{ mode: "sql", sql: "get k" }, "SQL runs work with SQL databases."],
    [{ mode: "table", needle: "" }, "Table peek works with SQL databases."],
  ] as const)("declines %o on a non-SQL engine", (input, text) => {
    expect(
      modeView({ active: cache, connections, input, tables: [] })
    ).toStrictEqual({ note: { text, tone: "unsupported" }, sections: [] });
  });

  it("lists matched tables", () => {
    const result = modeView({
      active: analytics,
      connections,
      input: { mode: "table", needle: "ord" },
      tables: [{ id: "table-public.orders", schema: "public", table: orders }],
    });
    expect(result.sections[0]?.items).toStrictEqual([
      {
        id: "table-public.orders",
        kind: "table",
        schema: "public",
        table: orders,
      },
    ]);
  });

  it("has no sections when no table matches", () => {
    expect(
      modeView({
        active: analytics,
        connections,
        input: { mode: "table", needle: "zz" },
        tables: [],
      }).sections
    ).toStrictEqual([]);
  });

  it("filters connections to switch to", () => {
    const result = modeView({
      active: analytics,
      connections,
      input: { mode: "connection", needle: "bil" },
      tables: [],
    });
    expect(result.sections[0]?.label).toBe("Switch connection");
    expect(result.sections[0]?.items.map((item) => item.id)).toStrictEqual([
      "billing",
    ]);
  });
});
