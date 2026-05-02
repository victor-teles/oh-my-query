import { describe, expect, it } from "vitest";

import {
  parseClickhouse,
  parseDuckdb,
  parseMysql,
  parsePostgres,
} from "./explain-parser.ts";

describe("parsePostgres", () => {
  const indexScanFixture = {
    Plan: {
      "Actual Rows": 12,
      "Node Type": "Index Scan",
      "Plan Rows": 10,
      "Relation Name": "users",
      "Startup Cost": 0.5,
      "Total Cost": 8.25,
    },
  };

  it("populates id, nodeType and label from an object-rooted plan", () => {
    const plan = parsePostgres(indexScanFixture);
    expect(plan.id).toBe("p");
    expect(plan.nodeType).toBe("Index Scan");
    expect(plan.label).toBe("Index Scan on users");
  });

  it("populates cost and rows from an object-rooted plan", () => {
    const plan = parsePostgres(indexScanFixture);
    expect(plan.cost.startup).toBe(0.5);
    expect(plan.cost.total).toBe(8.25);
    expect(plan.rows.estimated).toBe(10);
    expect(plan.rows.actual).toBe(12);
  });

  it("parses an array-rooted plan (real EXPLAIN FORMAT JSON shape)", () => {
    const plan = parsePostgres([
      { Plan: { "Node Type": "Seq Scan", "Relation Name": "t" } },
    ]);
    expect(plan.nodeType).toBe("Seq Scan");
  });

  it("throws when the Plan field is missing", () => {
    expect(() => parsePostgres({})).toThrow(/missing Plan/);
  });

  it("flags a Seq Scan node with a Sequential scan warning", () => {
    const plan = parsePostgres({
      Plan: { "Node Type": "Seq Scan", "Relation Name": "t" },
    });
    expect(plan.warnings).toContain("Sequential scan");
  });

  it("flags row-estimate ratio drift > 10×", () => {
    const plan = parsePostgres({
      Plan: {
        "Actual Rows": 1000,
        "Node Type": "Index Scan",
        "Plan Rows": 1,
      },
    });
    const rowWarn = plan.warnings.find((w) => w.includes("Row estimate"));
    expect(rowWarn).toBeTruthy();
    expect(rowWarn).toContain("1000×");
  });

  it("flags disk sort when Sort Method detail contains 'disk' (lowercase)", () => {
    const plan = parsePostgres({
      Plan: {
        "Node Type": "Sort",
        "Sort Method": "external merge disk: 1024kB",
      },
    });
    expect(plan.warnings).toContain("Disk sort");
  });

  it("recurses into Plans with id path p.0, p.1, p.0.0", () => {
    const plan = parsePostgres({
      Plan: {
        "Node Type": "Hash Join",
        Plans: [
          {
            "Node Type": "Seq Scan",
            Plans: [{ "Node Type": "Materialize" }],
            "Relation Name": "a",
          },
          { "Node Type": "Hash", "Relation Name": "b" },
        ],
      },
    });
    expect(plan.children).toHaveLength(2);
    expect(plan.children[0]?.id).toBe("p.0");
    expect(plan.children[1]?.id).toBe("p.1");
    expect(plan.children[0]?.children[0]?.id).toBe("p.0.0");
  });

  it("computes selfMs by subtracting children, honoring loops", () => {
    const plan = parsePostgres({
      Plan: {
        "Actual Loops": 1,
        "Actual Total Time": 100,
        "Node Type": "Hash Join",
        Plans: [
          {
            "Actual Loops": 2,
            "Actual Total Time": 20,
            "Node Type": "Seq Scan",
            "Relation Name": "a",
          },
        ],
      },
    });
    expect(plan.cost.actualTotalMs).toBe(100);
    expect(plan.children[0]?.cost.actualTotalMs).toBe(40);
    expect(plan.cost.selfMs).toBe(60);
  });
});

describe("parseMysql", () => {
  it("throws when root is not an object", () => {
    expect(() => parseMysql(null)).toThrow(/query_block/);
  });

  it("throws when query_block is null", () => {
    expect(() => parseMysql({ query_block: null })).toThrow(/query_block/);
  });

  it("maps access_type ALL to Full Table Scan with warning", () => {
    const plan = parseMysql({
      query_block: {
        table: { access_type: "ALL", table_name: "users" },
      },
    });
    expect(plan.nodeType).toBe("Full Table Scan");
    expect(plan.label).toBe("Full Table Scan on users");
    expect(plan.warnings).toContain("Full table scan");
  });

  it.each([
    ["index", "Full Index Scan"],
    ["range", "Range Scan"],
    ["ref", "Ref Scan"],
    ["const", "Const Scan"],
    ["eq_ref", "Const Scan"],
    ["system", "system Scan"],
  ])("maps access_type %s to nodeType %s", (accessType, expected) => {
    const plan = parseMysql({
      query_block: {
        table: { access_type: accessType, table_name: "t" },
      },
    });
    expect(plan.nodeType).toBe(expected);
  });

  it("recurses through nested_loop with ids m.0 and m.1", () => {
    const plan = parseMysql({
      query_block: {
        nested_loop: [
          { table: { access_type: "ref", table_name: "a" } },
          { table: { access_type: "ALL", table_name: "b" } },
        ],
      },
    });
    expect(plan.nodeType).toBe("Nested Loop");
    expect(plan.children[0]?.id).toBe("m.0");
    expect(plan.children[1]?.id).toBe("m.1");
    expect(plan.children[1]?.warnings).toContain("Full table scan");
  });

  it("recurses through ordering_operation as a single child", () => {
    const plan = parseMysql({
      query_block: {
        nested_loop: null,
        ordering_operation: {
          table: { access_type: "ref", table_name: "t" },
        },
      },
    });
    expect(plan.nodeType).toBe("Ordering");
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0]?.id).toBe("m.0");
  });

  it("populates cost.total from cost_info.query_cost and rows.estimated", () => {
    const plan = parseMysql({
      query_block: {
        cost_info: { query_cost: "12.34" },
        nested_loop: [],
        rows_produced_per_join: 42,
      },
    });
    expect(plan.cost.total).toBe(12.34);
    expect(plan.rows.estimated).toBe(42);
  });
});

describe("parseClickhouse", () => {
  it("parses an object root with Plan field", () => {
    const plan = parseClickhouse({
      Plan: { "Node Type": "Expression", Plans: [] },
    });
    expect(plan.nodeType).toBe("Expression");
  });

  it("parses an array root using the first element", () => {
    const plan = parseClickhouse([{ Plan: { "Node Type": "Aggregating" } }]);
    expect(plan.nodeType).toBe("Aggregating");
  });

  it("falls through to root when no Plan field exists", () => {
    const plan = parseClickhouse({ "Node Type": "ReadFromMergeTree" });
    expect(plan.nodeType).toBe("ReadFromMergeTree");
  });

  it("throws on empty array root", () => {
    expect(() => parseClickhouse([])).toThrow(/empty/i);
  });

  it("recurses into Plans producing c.0 and c.0.0 ids", () => {
    const plan = parseClickhouse({
      Plan: {
        "Node Type": "Expression",
        Plans: [
          {
            "Node Type": "Filter",
            Plans: [{ "Node Type": "ReadFromMergeTree" }],
          },
        ],
      },
    });
    expect(plan.children[0]?.id).toBe("c.0");
    expect(plan.children[0]?.children[0]?.id).toBe("c.0.0");
  });
});

describe("parseDuckdb", () => {
  it("uses the first element of an array root", () => {
    const plan = parseDuckdb([{ name: "PROJECTION" }]);
    expect(plan.nodeType).toBe("PROJECTION");
  });

  it("throws when root is null", () => {
    expect(() => parseDuckdb(null)).toThrow(/empty/i);
  });

  it("converts operator_timing seconds to ms", () => {
    const plan = parseDuckdb({ name: "SCAN", operator_timing: 0.05 });
    expect(plan.timing.actualTotalMs).toBe(50);
    expect(plan.cost.actualTotalMs).toBe(50);
    expect(plan.cost.selfMs).toBe(50);
  });

  it("computes selfMs by subtracting children", () => {
    const plan = parseDuckdb({
      children: [{ name: "SCAN", operator_timing: 0.04 }],
      name: "PROJECTION",
      operator_timing: 0.1,
    });
    expect(plan.cost.actualTotalMs).toBe(100);
    expect(plan.children[0]?.cost.actualTotalMs).toBe(40);
    expect(plan.cost.selfMs).toBe(60);
  });
});
