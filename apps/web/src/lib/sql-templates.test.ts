import { describe, expect, it } from "vitest";

import type { TableItem, ViewItem } from "@/lib/tauri";

import {
  generateCreateTable,
  generateDropTable,
  generateSelectTop100,
  generateTruncateTable,
} from "@/lib/sql-templates";

const makeTable = (overrides: Partial<TableItem> = {}): TableItem => ({
  columns: [
    {
      dataType: "INTEGER",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    },
    {
      dataType: "TEXT",
      defaultValue: "''",
      isNullable: true,
      isPrimaryKey: false,
      name: "name",
    },
  ],
  foreignKeys: [],
  indexes: [],
  name: "users",
  rowEstimate: null,
  ...overrides,
});

describe("generateSelectTop100", () => {
  it("emits a 100-row LIMIT", () => {
    expect(generateSelectTop100("orders")).toBe(
      "SELECT * FROM orders LIMIT 100;"
    );
  });
});

describe("generateDropTable", () => {
  it("emits DROP TABLE for a table", () => {
    expect(generateDropTable("orders", false)).toBe("DROP TABLE orders;");
  });

  it("emits DROP VIEW for a view", () => {
    expect(generateDropTable("orders_view", true)).toBe(
      "DROP VIEW orders_view;"
    );
  });
});

describe("generateTruncateTable", () => {
  it("emits TRUNCATE TABLE", () => {
    expect(generateTruncateTable("orders")).toBe("TRUNCATE TABLE orders;");
  });
});

describe("generateCreateTable", () => {
  it("renders columns with PRIMARY KEY, NOT NULL, and DEFAULT", () => {
    const sql = generateCreateTable(makeTable(), false);
    expect(sql).toContain("CREATE TABLE users (");
    expect(sql).toContain("id INTEGER PRIMARY KEY NOT NULL");
    expect(sql).toContain("name TEXT DEFAULT ''");
    expect(sql.endsWith(");")).toBeTruthy();
  });

  it("returns a stub comment for views", () => {
    const view: ViewItem = {
      columns: [],
      name: "active_users",
    };
    const sql = generateCreateTable(view, true);
    expect(sql).toContain("CREATE VIEW statement not available");
    expect(sql).toContain("active_users");
  });

  it("omits PRIMARY KEY when isPrimaryKey is false", () => {
    const table = makeTable({
      columns: [
        {
          dataType: "INTEGER",
          defaultValue: null,
          isNullable: false,
          isPrimaryKey: false,
          name: "id",
        },
      ],
    });
    const sql = generateCreateTable(table, false);
    expect(sql).not.toContain("PRIMARY KEY");
    expect(sql).toContain("id INTEGER NOT NULL");
  });
});
