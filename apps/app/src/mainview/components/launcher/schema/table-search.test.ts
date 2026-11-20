import type { SchemaInfo, TableItem } from "@oh-my-query/core/client";

import { describe, expect, it } from "vitest";

import {
  catalogTables,
  MAX_TABLES_SHOWN,
  searchTables,
  tableItemId,
} from "./table-search";

const table = (name: string): TableItem => ({
  columns: [],
  foreignKeys: [],
  indexes: [],
  name,
  rowEstimate: null,
});

const schema: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: ["orders", "order_items", "customers", "store_orders"].map(table),
      views: [],
    },
    { name: "billing", tables: [table("orders")], views: [] },
  ],
};

const names = (needle: string) =>
  searchTables(catalogTables(schema), needle).map(
    (entry) => `${entry.schema}.${entry.table.name}`
  );

describe("catalogTables", () => {
  it("flattens every schema's tables with stable ids", () => {
    const tables = catalogTables(schema);
    expect(tables).toHaveLength(5);
    expect(tables[0]?.id).toBe(tableItemId("public", "orders"));
  });
});

describe("searchTables", () => {
  it("ranks exact names, then prefixes, then fuzzy matches, ties in catalog order", () => {
    expect(names("orders")).toStrictEqual([
      "public.orders",
      "billing.orders",
      "public.order_items",
      "public.store_orders",
    ]);
  });

  it("prefers the shorter prefix match", () => {
    expect(names("ord").slice(0, 3)).toStrictEqual([
      "public.orders",
      "billing.orders",
      "public.order_items",
    ]);
  });

  it("matches schema.table needles on both parts", () => {
    expect(names("bill.ord")).toStrictEqual(["billing.orders"]);
    expect(names("public.")).toHaveLength(4);
  });

  it("returns nothing when no table matches", () => {
    expect(names("zzz")).toStrictEqual([]);
  });

  it("caps the list", () => {
    const many: SchemaInfo = {
      schemas: [
        {
          name: "public",
          tables: Array.from({ length: 80 }, (_, i) => table(`t${i}`)),
          views: [],
        },
      ],
    };
    expect(searchTables(catalogTables(many), "")).toHaveLength(
      MAX_TABLES_SHOWN
    );
  });
});
