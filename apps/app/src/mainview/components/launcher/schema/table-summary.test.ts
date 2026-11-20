import type { TableItem } from "@oh-my-query/core/client";

import { describe, expect, it } from "vitest";

import {
  columnCountLabel,
  foreignTargets,
  rowEstimateLabel,
  tableSummary,
} from "./table-summary";

const orders: TableItem = {
  columns: [
    {
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    },
    {
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: false,
      name: "customer_id",
    },
    {
      dataType: "numeric",
      defaultValue: null,
      isNullable: true,
      isPrimaryKey: false,
      name: "total",
    },
  ],
  foreignKeys: [
    {
      columns: ["customer_id"],
      name: "orders_customer_fk",
      referencedColumns: ["id"],
      referencedTable: "customers",
    },
  ],
  indexes: [],
  name: "orders",
  rowEstimate: 1_200_000,
};

describe("table summary", () => {
  it.each([
    [1_200_000, "~1.2M rows"],
    [950, "~950 rows"],
    [0, "~0 rows"],
    [null, "rows unknown"],
  ])("labels %s rows as %s", (estimate, label) => {
    expect(rowEstimateLabel(estimate)).toBe(label);
  });

  it("counts columns", () => {
    expect(columnCountLabel(orders)).toBe("3 columns");
    expect(
      columnCountLabel({ ...orders, columns: orders.columns.slice(0, 1) })
    ).toBe("1 column");
  });

  it("maps foreign-key columns to their targets", () => {
    expect([...foreignTargets(orders)]).toStrictEqual([
      ["customer_id", "customers.id"],
    ]);
  });

  it("summarises a table for screen readers", () => {
    expect(tableSummary(orders)).toBe(
      "orders, 3 columns, about 1.2 million rows, primary key id"
    );
    expect(tableSummary({ ...orders, columns: [], rowEstimate: null })).toBe(
      "orders, 0 columns, row count unknown"
    );
  });
});
