import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import type { ExecuteResult, TabularResult } from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";
import { access, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  DuckdbPool,
  mapDuckdbError,
  parseExpressionList,
  parseRowEstimate,
} from "./pool.ts";

const tabular = (r: ExecuteResult): TabularResult => {
  expect(r.resultType).toBe("tabular");
  return r as TabularResult;
};

interface ColumnSpec {
  name: string;
  type: string;
}

interface QueryResult {
  rows: unknown[][];
  columns?: ColumnSpec[];
}

const empty: QueryResult = { columns: [], rows: [] };

interface QueryFixtures {
  relations?: QueryResult;
  columns?: QueryResult;
  indexes?: QueryResult;
  foreignKeys?: QueryResult;
  explain?: string;
  analyze?: string;
  arbitrary?: QueryResult;
}

const dispatch = (sql: string, fixtures: QueryFixtures): QueryResult => {
  if (sql.includes("FROM information_schema.tables")) {
    return fixtures.relations ?? empty;
  }
  if (sql.includes("FROM duckdb_columns()")) {
    return fixtures.columns ?? empty;
  }
  if (sql.includes("FROM duckdb_indexes()")) {
    return fixtures.indexes ?? empty;
  }
  if (
    sql.includes("FROM duckdb_constraints()") &&
    sql.includes("FOREIGN KEY")
  ) {
    return fixtures.foreignKeys ?? empty;
  }
  if (sql.startsWith("EXPLAIN (FORMAT JSON)")) {
    return {
      columns: [
        { name: "explain_key", type: "VARCHAR" },
        { name: "explain_value", type: "VARCHAR" },
      ],
      rows: [["physical_plan", fixtures.explain ?? "[]"]],
    };
  }
  return fixtures.arbitrary ?? empty;
};

const fakeReader = (result: QueryResult) => ({
  columnName: (i: number) => result.columns?.[i]?.name ?? `col_${i}`,
  columnNames: () => (result.columns ?? []).map((c) => c.name),
  columnType: (i: number) => ({
    toString: () => result.columns?.[i]?.type ?? "UNKNOWN",
  }),
  getRowObjectsJson: () => {
    const cols = result.columns ?? [];
    return result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i += 1) {
        const col = cols[i];
        if (col) {
          obj[col.name] = row[i];
        }
      }
      return obj;
    });
  },
  getRowsJson: () => result.rows,
});

const buildPool = (fixtures: QueryFixtures = {}, profileJson?: string) => {
  let interrupted = false;
  let profileTarget: string | null = null;
  let mostRecentSql: string | null = null;

  const runAndReadAll = vi.fn(async (sql: string) => {
    mostRecentSql = sql;
    if (sql.includes("--block--")) {
      const { promise, reject } = Promise.withResolvers<unknown>();
      const checkInterrupt = () => {
        if (interrupted) {
          reject(new Error("Query interrupted"));
          return;
        }
        setTimeout(checkInterrupt, 5);
      };
      checkInterrupt();
      await promise;
      return fakeReader(empty);
    }
    if (sql.includes("does_not_exist")) {
      throw new Error("table not found");
    }
    return fakeReader(dispatch(sql, fixtures));
  });

  const run = vi.fn(async (sql: string) => {
    mostRecentSql = sql;
    const profileMatch = /PRAGMA profiling_output = '([^']+)'/.exec(sql);
    if (profileMatch) {
      profileTarget = profileMatch[1] ?? null;
    } else if (
      profileTarget &&
      profileJson !== undefined &&
      !sql.startsWith("PRAGMA") &&
      !sql.startsWith("SET ")
    ) {
      await writeFile(profileTarget, profileJson);
      profileTarget = null;
    }
    return fakeReader(empty);
  });

  const interrupt = vi.fn(() => {
    interrupted = true;
  });

  const disconnect = vi.fn();

  const conn = {
    disconnect,
    interrupt,
    run,
    runAndReadAll,
  } as unknown as DuckDBConnection;

  const fakeInstance = {
    connect: vi.fn().mockResolvedValue(conn),
  } as unknown as DuckDBInstance;

  return {
    conn,
    disconnect,
    interrupt,
    pool: new DuckdbPool(fakeInstance),
    run,
    runAndReadAll,
    sqlSeen: () => mostRecentSql,
  };
};

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

const profilePathOf = (sql: string): string => {
  const match = /PRAGMA profiling_output = '([^']+)'/.exec(sql);
  return match?.[1] ?? "";
};

describe("duckdbPool > metadata", () => {
  it("fetchVersion returns the version() column value", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columns: [{ name: "version", type: "VARCHAR" }],
        rows: [["v1.1.3"]],
      },
    });
    await expect(pool.fetchVersion()).resolves.toBe("v1.1.3");
  });

  it("listDatabases returns schema names from information_schema.schemata", async () => {
    const { pool, runAndReadAll } = buildPool({
      arbitrary: {
        columns: [{ name: "schema_name", type: "VARCHAR" }],
        rows: [["main"], ["scoped"]],
      },
    });
    const dbs = await pool.listDatabases();
    expect(dbs).toStrictEqual(["main", "scoped"]);
    expect(runAndReadAll.mock.calls[0]?.[0]).toContain(
      "FROM information_schema.schemata"
    );
  });
});

describe("duckdbPool > fetchSchema", () => {
  it("returns an empty schema when no relations exist", async () => {
    const { pool, runAndReadAll } = buildPool();
    const result = await pool.fetchSchema("main");
    expect(result).toStrictEqual({
      schemas: [{ name: "main", tables: [], views: [] }],
    });
    // 4 catalog queries: relations, columns, indexes, FKs.
    expect(runAndReadAll).toHaveBeenCalledTimes(4);
  });

  it("returns tables and views in the order returned by the catalog", async () => {
    const { pool } = buildPool({
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [
          ["accounts", "BASE TABLE", "10"],
          ["active_users", "VIEW", null],
          ["orders", "BASE TABLE", "200"],
        ],
      },
    });
    const result = await pool.fetchSchema("main");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual([
      "accounts",
      "orders",
    ]);
    expect(schema.tables.map((t) => t.rowEstimate)).toStrictEqual([10, 200]);
    expect(schema.views.map((v) => v.name)).toStrictEqual(["active_users"]);
  });

  it("flags primary key columns and leaves others unflagged", async () => {
    const { pool } = buildPool({
      columns: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "column_name", type: "VARCHAR" },
          { name: "data_type", type: "VARCHAR" },
          { name: "is_nullable", type: "BOOLEAN" },
          { name: "column_default", type: "VARCHAR" },
          { name: "is_pk", type: "BOOLEAN" },
        ],
        rows: [
          ["users", "id", "INTEGER", false, null, true],
          ["users", "email", "VARCHAR", true, null, false],
        ],
      },
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [["users", "BASE TABLE", "0"]],
      },
    });
    const result = await pool.fetchSchema("main");
    const table = must(result.schemas[0]?.tables[0], "tables[0]");
    expect(table.columns.map((c) => [c.name, c.isPrimaryKey])).toStrictEqual([
      ["id", true],
      ["email", false],
    ]);
    expect(must(table.columns[1], "columns[1]").isNullable).toBeTruthy();
  });

  it("parses bracketed expression lists into ordered index columns", async () => {
    const { pool } = buildPool({
      indexes: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "index_name", type: "VARCHAR" },
          { name: "is_unique", type: "BOOLEAN" },
          { name: "expressions", type: "VARCHAR" },
        ],
        rows: [
          ["events", "events_created_user_idx", false, "[created_at, user_id]"],
          ["events", "events_payload_idx", true, "[payload]"],
        ],
      },
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [["events", "BASE TABLE", null]],
      },
    });
    const result = await pool.fetchSchema("main");
    const table = must(result.schemas[0]?.tables[0], "tables[0]");
    const ordered = must(
      table.indexes.find((i) => i.name === "events_created_user_idx"),
      "ordered idx"
    );
    expect(ordered.columns).toStrictEqual(["created_at", "user_id"]);
    expect(ordered.isUnique).toBeFalsy();
    const unique = must(
      table.indexes.find((i) => i.name === "events_payload_idx"),
      "unique idx"
    );
    expect(unique.isUnique).toBeTruthy();
  });

  it("preserves multi-column foreign key arrays as a single constraint", async () => {
    const { pool } = buildPool({
      foreignKeys: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "constraint_name", type: "VARCHAR" },
          { name: "constraint_column_names", type: "VARCHAR[]" },
          { name: "referenced_table", type: "VARCHAR" },
          { name: "referenced_column_names", type: "VARCHAR[]" },
        ],
        rows: [
          [
            "orders",
            "orders_tenant_user_fkey",
            ["tenant_id", "user_id"],
            "users",
            ["tenant_id", "id"],
          ],
        ],
      },
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [["orders", "BASE TABLE", null]],
      },
    });
    const result = await pool.fetchSchema("main");
    const table = must(result.schemas[0]?.tables[0], "tables[0]");
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0]).toStrictEqual({
      columns: ["tenant_id", "user_id"],
      name: "orders_tenant_user_fkey",
      referencedColumns: ["tenant_id", "id"],
      referencedTable: "users",
    });
  });

  it("populates view columns and ignores indexes/FKs targeting views", async () => {
    const { pool } = buildPool({
      columns: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "column_name", type: "VARCHAR" },
          { name: "data_type", type: "VARCHAR" },
          { name: "is_nullable", type: "BOOLEAN" },
          { name: "column_default", type: "VARCHAR" },
          { name: "is_pk", type: "BOOLEAN" },
        ],
        rows: [["active_users", "id", "INTEGER", false, null, false]],
      },
      indexes: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "index_name", type: "VARCHAR" },
          { name: "is_unique", type: "BOOLEAN" },
          { name: "expressions", type: "VARCHAR" },
        ],
        rows: [["active_users", "phantom", false, "[id]"]],
      },
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [["active_users", "VIEW", null]],
      },
    });
    const result = await pool.fetchSchema("main");
    const view = must(result.schemas[0]?.views[0], "views[0]");
    expect(view.name).toBe("active_users");
    expect(view.columns.map((c) => c.name)).toStrictEqual(["id"]);
    expect(result.schemas[0]?.tables).toStrictEqual([]);
  });

  it("rejects invalid schema names without issuing queries", async () => {
    const { pool, runAndReadAll } = buildPool();
    await expect(pool.fetchSchema('"; DROP TABLE x; --')).rejects.toThrow(
      /schema/i
    );
    expect(runAndReadAll).not.toHaveBeenCalled();
  });
});

describe("duckdbPool > execute", () => {
  it("returns rows and column metadata from the reader", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columns: [{ name: "n", type: "INTEGER" }],
        rows: [[1]],
      },
    });
    const r = tabular(
      await pool.execute(
        "SELECT 1 AS n",
        100,
        null,
        new AbortController().signal
      )
    );
    expect(r.columns).toStrictEqual([{ name: "n", typeName: "INTEGER" }]);
    expect(r.rows).toStrictEqual([[1]]);
    expect(r.isTruncated).toBeFalsy();
  });

  it("truncates rows past maxRows and flags isTruncated", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columns: [{ name: "v", type: "INTEGER" }],
        rows: [[1], [2], [3], [4], [5]],
      },
    });
    const r = tabular(
      await pool.execute(
        "SELECT v FROM big",
        3,
        null,
        new AbortController().signal
      )
    );
    expect(r.rows).toStrictEqual([[1], [2], [3]]);
    expect(r.isTruncated).toBeTruthy();
  });

  it("issues SET search_path before the query when schema is provided", async () => {
    const { pool, run } = buildPool({
      arbitrary: {
        columns: [{ name: "v", type: "INTEGER" }],
        rows: [[1]],
      },
    });
    await pool.execute(
      "SELECT v FROM scoped_table",
      10,
      "scoped",
      new AbortController().signal
    );
    expect(run.mock.calls[0]?.[0]).toBe("SET search_path = 'scoped'");
  });

  it("rejects an invalid schema name without running any SQL", async () => {
    const { pool, run, runAndReadAll } = buildPool();
    await expect(
      pool.execute(
        "SELECT 1",
        10,
        '"; DROP TABLE users; --',
        new AbortController().signal
      )
    ).rejects.toBeInstanceOf(DbError);
    expect(run).not.toHaveBeenCalled();
    expect(runAndReadAll).not.toHaveBeenCalled();
  });

  it("wraps native errors in DbError", async () => {
    const { pool } = buildPool();
    await expect(
      pool.execute(
        "SELECT * FROM does_not_exist",
        10,
        null,
        new AbortController().signal
      )
    ).rejects.toBeInstanceOf(DbError);
  });
});

describe("duckdbPool > execute cancellation", () => {
  it("rejects with QUERY_CANCELLED when aborted before execute", async () => {
    const { disconnect, pool } = buildPool();
    const controller = new AbortController();
    controller.abort(DbError.cancelled());
    const error = await pool
      .execute("SELECT 1", 10, null, controller.signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("QUERY_CANCELLED");
    expect(disconnect).toHaveBeenCalledWith();
  });

  it("interrupts and disconnects when aborted mid-flight", async () => {
    const { disconnect, interrupt, pool } = buildPool();
    const controller = new AbortController();
    const promise = pool.execute(
      "SELECT --block-- 1",
      10,
      null,
      controller.signal
    );
    await Promise.resolve();
    controller.abort(DbError.cancelled());
    const error = await promise.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("QUERY_CANCELLED");
    expect(interrupt).toHaveBeenCalledWith();
    expect(disconnect).toHaveBeenCalledWith();
  });
});

describe("duckdbPool > explain", () => {
  it("returns a structured plan tree from EXPLAIN (FORMAT JSON)", async () => {
    const { pool } = buildPool({
      explain: JSON.stringify([
        {
          children: [],
          extra_info: { Text: "users" },
          name: "SEQ_SCAN",
        },
      ]),
    });
    const r = await pool.explain(
      "SELECT * FROM users",
      false,
      null,
      new AbortController().signal
    );
    expect(r.engine).toBe("duckdb");
    expect(r.analyzeRan).toBeFalsy();
    expect(r.supportsAnalyze).toBeTruthy();
    expect(r.root.nodeType).toBe("SEQ_SCAN");
    expect(r.raw.length).toBeGreaterThan(0);
  });

  it("runs ANALYZE via PRAGMA enable_profiling and parses the JSON output", async () => {
    const profile = JSON.stringify({
      children: [
        {
          children: [],
          extra_info: { Text: "users" },
          operator_cardinality: 1,
          operator_timing: 0.001,
          operator_type: "TABLE_SCAN",
        },
      ],
      latency: 0.002,
    });
    const { pool, run } = buildPool({}, profile);
    const r = await pool.explain(
      "SELECT * FROM users",
      true,
      null,
      new AbortController().signal
    );
    expect(r.analyzeRan).toBeTruthy();
    expect(r.root.nodeType).toBe("Query");
    expect(r.root.children[0]?.nodeType).toBe("TABLE_SCAN");
    expect(
      run.mock.calls.some((c) => c[0] === "PRAGMA enable_profiling = 'json'")
    ).toBeTruthy();
  });

  it("rejects EXPLAIN ANALYZE on destructive statements", async () => {
    const { pool } = buildPool();
    const r = pool.explain(
      "INSERT INTO t VALUES (1)",
      true,
      null,
      new AbortController().signal
    );
    await expect(r).rejects.toMatchObject({ code: "EXPLAIN_DESTRUCTIVE" });
  });

  it("rejects empty SQL with EXPLAIN_EMPTY", async () => {
    const { pool } = buildPool();
    const r = pool.explain("   ;  ", false, null, new AbortController().signal);
    await expect(r).rejects.toMatchObject({ code: "EXPLAIN_EMPTY" });
  });
});

describe("duckdbPool > close", () => {
  it("makes subsequent operations fail with POOL_CLOSED", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });
});

describe("mapDuckdbError", () => {
  it("returns DbError instances unchanged", () => {
    const original = new DbError("FOO", "bar");
    expect(mapDuckdbError(original)).toBe(original);
  });

  it("wraps generic Error into DbError with DB_ERROR code", () => {
    const wrapped = mapDuckdbError(new Error("boom"));
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.code).toBe("DB_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("falls back to a generic message for non-Error values", () => {
    const wrapped = mapDuckdbError(42);
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("42");
  });

  it("preserves a non-default code from the underlying error", () => {
    const wrapped = mapDuckdbError({
      code: "PERMISSION_DENIED",
      message: "denied",
    });
    expect(wrapped.code).toBe("PERMISSION_DENIED");
    expect(wrapped.message).toBe("denied");
  });

  it("uses the error name as a last resort message", () => {
    const wrapped = mapDuckdbError({ name: "WeirdError" });
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("WeirdError");
  });
});

describe("duckdbPool > metadata edge cases", () => {
  it("fetchVersion returns empty string when the row is missing", async () => {
    const { pool } = buildPool({
      arbitrary: { columns: [{ name: "version", type: "VARCHAR" }], rows: [] },
    });
    await expect(pool.fetchVersion()).resolves.toBe("");
  });

  it("fetchVersion returns empty string when the value is non-string", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columns: [{ name: "version", type: "INTEGER" }],
        rows: [[42]],
      },
    });
    await expect(pool.fetchVersion()).resolves.toBe("");
  });

  it("fetchVersion wraps native errors as DbError", async () => {
    const { pool, runAndReadAll } = buildPool();
    runAndReadAll.mockRejectedValueOnce(new Error("connection lost"));
    const error = await pool.fetchVersion().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).message).toBe("connection lost");
  });

  it("listDatabases drops non-string rows", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columns: [{ name: "schema_name", type: "VARCHAR" }],
        rows: [["main"], [null], [42], ["scoped"]],
      },
    });
    await expect(pool.listDatabases()).resolves.toStrictEqual([
      "main",
      "scoped",
    ]);
  });
});

describe("duckdbPool > fetchSchema error handling", () => {
  it("wraps underlying query failures in DbError", async () => {
    const { pool, runAndReadAll } = buildPool();
    runAndReadAll.mockRejectedValueOnce(new Error("catalog unavailable"));
    const error = await pool
      .fetchSchema("main")
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).message).toBe("catalog unavailable");
  });

  it("ignores foreign keys whose referenced_table is null", async () => {
    const { pool } = buildPool({
      foreignKeys: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "constraint_name", type: "VARCHAR" },
          { name: "constraint_column_names", type: "VARCHAR[]" },
          { name: "referenced_table", type: "VARCHAR" },
          { name: "referenced_column_names", type: "VARCHAR[]" },
        ],
        rows: [["orders", "orphan_fk", ["x"], null, []]],
      },
      relations: {
        columns: [
          { name: "table_name", type: "VARCHAR" },
          { name: "table_type", type: "VARCHAR" },
          { name: "estimated_size", type: "BIGINT" },
        ],
        rows: [["orders", "BASE TABLE", null]],
      },
    });
    const result = await pool.fetchSchema("main");
    expect(result.schemas[0]?.tables[0]?.foreignKeys).toStrictEqual([]);
  });
});

describe("duckdbPool > execute additional behavior", () => {
  it("maps a non-DbError mid-flight abort through mapDuckdbError", async () => {
    const { pool } = buildPool();
    const controller = new AbortController();
    const promise = pool.execute(
      "SELECT --block-- 1",
      10,
      null,
      controller.signal
    );
    await Promise.resolve();
    controller.abort(new Error("user closed tab"));
    const error = await promise.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).not.toBe("QUERY_CANCELLED");
  });

  it("removes the abort listener after a successful run", async () => {
    const { interrupt, pool } = buildPool({
      arbitrary: { columns: [{ name: "n", type: "INT" }], rows: [[1]] },
    });
    const controller = new AbortController();
    await pool.execute("SELECT 1", 10, null, controller.signal);
    interrupt.mockClear();
    controller.abort(DbError.cancelled());
    expect(interrupt).not.toHaveBeenCalled();
  });
});

describe("duckdbPool > explain additional behavior", () => {
  it("rejects with EXPLAIN_NO_OUTPUT when EXPLAIN returns no rows", async () => {
    const { pool, runAndReadAll } = buildPool();
    runAndReadAll.mockResolvedValueOnce({
      columnName: () => "",
      columnNames: () => [],
      columnType: () => ({ toString: () => "" }),
      getRowObjectsJson: () => [],
      getRowsJson: () => [],
    } as unknown as Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>>);
    const error = await pool
      .explain("SELECT 1", false, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("EXPLAIN_NO_OUTPUT");
  });

  it("rejects with EXPLAIN_NO_OUTPUT when ANALYZE produces no profile", async () => {
    // No profileJson supplied → the mock writes nothing → readFile fails.
    const { pool } = buildPool({});
    const error = await pool
      .explain("SELECT 1", true, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("EXPLAIN_NO_OUTPUT");
  });

  it("issues SET search_path before EXPLAIN when schema is provided", async () => {
    const { pool, run } = buildPool({
      explain: JSON.stringify([{ children: [], extra_info: {}, name: "SCAN" }]),
    });
    await pool.explain(
      "SELECT 1",
      false,
      "scoped",
      new AbortController().signal
    );
    expect(run.mock.calls[0]?.[0]).toBe("SET search_path = 'scoped'");
  });

  it("removes the analyze profile file after a successful run", async () => {
    const profile = JSON.stringify({ children: [], latency: 0.001 });
    const { pool, run } = buildPool({}, profile);
    await pool.explain("SELECT 1", true, null, new AbortController().signal);
    const profileTarget = must(
      run.mock.calls.map((c) => profilePathOf(c[0])).find(Boolean),
      "profile path"
    );
    await expect(access(profileTarget)).rejects.toThrow(/ENOENT/);
  });
});

describe("duckdbPool > close idempotency", () => {
  it("close called twice does not throw", async () => {
    const { pool } = buildPool();
    await pool.close();
    await expect(pool.close()).resolves.toBeUndefined();
  });
});

describe("parseExpressionList", () => {
  it("returns [] for null", () => {
    expect(parseExpressionList(null)).toStrictEqual([]);
  });

  it("returns [] for non-bracketed input", () => {
    expect(parseExpressionList("a, b")).toStrictEqual([]);
  });

  it("returns [] for empty brackets", () => {
    expect(parseExpressionList("[]")).toStrictEqual([]);
  });

  it("trims and splits comma-separated bracket contents", () => {
    expect(parseExpressionList("[ a , b,  c ]")).toStrictEqual(["a", "b", "c"]);
  });

  it("drops empty entries between commas", () => {
    expect(parseExpressionList("[a,,b]")).toStrictEqual(["a", "b"]);
  });
});

describe("parseRowEstimate", () => {
  it("returns null for null", () => {
    expect(parseRowEstimate(null)).toBeNull();
  });

  it("passes through a non-negative number", () => {
    expect(parseRowEstimate(42)).toBe(42);
  });

  it("parses a numeric string", () => {
    expect(parseRowEstimate("123")).toBe(123);
  });

  it("returns null for negative values", () => {
    expect(parseRowEstimate(-1)).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseRowEstimate("not a number")).toBeNull();
  });
});
