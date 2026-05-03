import type { Pool as MysqlPoolType } from "mysql2/promise";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { MysqlDriver } from "./driver";
import { mapMysqlError, MysqlPool } from "./pool";

interface QueryFixtures {
  relations?: Record<string, unknown>[];
  columns?: Record<string, unknown>[];
  indexes?: Record<string, unknown>[];
  foreignKeys?: Record<string, unknown>[];
  version?: string;
  databases?: string[];
}

const dispatchQuery = (
  sql: string,
  fixtures: QueryFixtures
): Record<string, unknown>[] => {
  if (sql.includes("VERSION()")) {
    return [{ version: fixtures.version ?? "8.4.0" }];
  }
  if (sql.includes("information_schema.schemata")) {
    return (fixtures.databases ?? []).map((name) => ({ name }));
  }
  if (sql.includes("information_schema.tables")) {
    return fixtures.relations ?? [];
  }
  if (sql.includes("information_schema.columns")) {
    return fixtures.columns ?? [];
  }
  if (sql.includes("information_schema.statistics")) {
    return fixtures.indexes ?? [];
  }
  if (sql.includes("information_schema.key_column_usage")) {
    return fixtures.foreignKeys ?? [];
  }
  throw new Error(`Unexpected query in dispatch: ${sql}`);
};

const buildPool = (fixtures: QueryFixtures) => {
  const query = vi
    .fn<(sql: string) => Promise<[Record<string, unknown>[], unknown[]]>>()
    .mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (sql) => [dispatchQuery(sql, fixtures), []]
    );
  const fakePool = { query } as unknown as MysqlPoolType;
  return { fakePool, query };
};

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

const tabular = (
  result: Awaited<ReturnType<MysqlPool["execute"]>>
): Extract<typeof result, { resultType: "tabular" }> => {
  if (result.resultType !== "tabular") {
    throw new Error("expected tabular result");
  }
  return result;
};

const sqlOf = (arg: unknown): string =>
  typeof arg === "string" ? arg : (arg as { sql: string }).sql;

describe("mysqlDriver", () => {
  it("identifies as mysql", () => {
    expect(new MysqlDriver().dbType).toBe("mysql");
  });
});

describe("mysqlPool.fetchVersion", () => {
  it("prefixes the server version", async () => {
    const { fakePool } = buildPool({ version: "8.4.0" });
    const pool = new MysqlPool(fakePool, "test");
    await expect(pool.fetchVersion()).resolves.toBe("MySQL 8.4.0");
  });

  it("falls back when version is missing", async () => {
    const query = vi.fn().mockResolvedValue([[{}], []]);
    const fakePool = { query } as unknown as MysqlPoolType;
    const pool = new MysqlPool(fakePool, "test");
    await expect(pool.fetchVersion()).resolves.toBe("MySQL");
  });
});

describe("mysqlPool.listDatabases", () => {
  it("returns user databases excluding system schemas", async () => {
    const { fakePool, query } = buildPool({
      databases: ["app", "warehouse"],
    });
    const pool = new MysqlPool(fakePool, "app");
    const dbs = await pool.listDatabases();
    expect(dbs).toStrictEqual(["app", "warehouse"]);
    expect(String(query.mock.calls[0]?.[0])).toMatch(
      /NOT IN.*'mysql'.*'information_schema'/s
    );
  });
});

describe("mysqlPool.fetchSchema", () => {
  it("issues exactly four schema-wide queries", async () => {
    const { fakePool, query } = buildPool({});
    const pool = new MysqlPool(fakePool, "app");
    const schema = await pool.fetchSchema("app");
    expect(query).toHaveBeenCalledTimes(4);
    expect(schema.schemas).toStrictEqual([
      { name: "app", tables: [], views: [] },
    ]);
  });

  it("returns tables and views with row estimates", async () => {
    const { fakePool } = buildPool({
      relations: [
        { table_name: "accounts", table_rows: 10, table_type: "BASE TABLE" },
        { table_name: "active_users", table_rows: null, table_type: "VIEW" },
        { table_name: "orders", table_rows: "200", table_type: "BASE TABLE" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual([
      "accounts",
      "orders",
    ]);
    expect(schema.tables.map((t) => t.rowEstimate)).toStrictEqual([10, 200]);
    expect(schema.views.map((v) => v.name)).toStrictEqual(["active_users"]);
  });

  it("flags primary key columns via column_key='PRI'", async () => {
    const { fakePool } = buildPool({
      columns: [
        {
          column_default: null,
          column_key: "PRI",
          column_name: "id",
          data_type: "int",
          is_nullable: "NO",
          table_name: "users",
        },
        {
          column_default: null,
          column_key: "MUL",
          column_name: "email",
          data_type: "varchar",
          is_nullable: "YES",
          table_name: "users",
        },
      ],
      relations: [
        { table_name: "users", table_rows: 0, table_type: "BASE TABLE" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.columns.map((c) => [c.name, c.isPrimaryKey])).toStrictEqual([
      ["id", true],
      ["email", false],
    ]);
    const email = must(table.columns[1], "columns[1]");
    expect(email.isNullable).toBeTruthy();
  });

  it("groups multi-column indexes preserving seq_in_index order", async () => {
    const { fakePool } = buildPool({
      indexes: [
        {
          column_name: "created_at",
          index_name: "events_created_user_idx",
          non_unique: 1,
          seq_in_index: 1,
          table_name: "events",
        },
        {
          column_name: "user_id",
          index_name: "events_created_user_idx",
          non_unique: 1,
          seq_in_index: 2,
          table_name: "events",
        },
      ],
      relations: [
        { table_name: "events", table_rows: 0, table_type: "BASE TABLE" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    const idx = must(table.indexes[0], "indexes[0]");
    expect(idx.columns).toStrictEqual(["created_at", "user_id"]);
    expect(idx.isUnique).toBeFalsy();
  });

  it("marks unique indexes when non_unique is 0", async () => {
    const { fakePool } = buildPool({
      indexes: [
        {
          column_name: "email",
          index_name: "users_email_uq",
          non_unique: 0,
          seq_in_index: 1,
          table_name: "users",
        },
      ],
      relations: [
        { table_name: "users", table_rows: 0, table_type: "BASE TABLE" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    const idx = must(must(schema.tables[0], "tables[0]").indexes[0], "idx");
    expect(idx.isUnique).toBeTruthy();
  });

  it("groups multi-column foreign keys under a single constraint", async () => {
    const { fakePool } = buildPool({
      foreignKeys: [
        {
          column_name: "tenant_id",
          constraint_name: "orders_tenant_user_fk",
          ordinal_position: 1,
          referenced_column_name: "tenant_id",
          referenced_table_name: "users",
          table_name: "orders",
        },
        {
          column_name: "user_id",
          constraint_name: "orders_tenant_user_fk",
          ordinal_position: 2,
          referenced_column_name: "id",
          referenced_table_name: "users",
          table_name: "orders",
        },
      ],
      relations: [
        { table_name: "orders", table_rows: 0, table_type: "BASE TABLE" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0]).toStrictEqual({
      columns: ["tenant_id", "user_id"],
      name: "orders_tenant_user_fk",
      referencedColumns: ["tenant_id", "id"],
      referencedTable: "users",
    });
  });

  it("populates view columns and ignores their indexes/FKs", async () => {
    const { fakePool } = buildPool({
      columns: [
        {
          column_default: null,
          column_key: "",
          column_name: "id",
          data_type: "int",
          is_nullable: "NO",
          table_name: "active_users",
        },
      ],
      relations: [
        { table_name: "active_users", table_rows: null, table_type: "VIEW" },
      ],
    });
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.fetchSchema("app");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.views[0]).toStrictEqual({
      columns: [
        {
          dataType: "int",
          defaultValue: null,
          isNullable: false,
          isPrimaryKey: false,
          name: "id",
        },
      ],
      name: "active_users",
    });
  });

  it("wraps pool failures in DbError", async () => {
    const failure = new Error("connection lost") as Error & {
      code?: string;
      errno?: number;
      sqlMessage?: string;
    };
    failure.code = "PROTOCOL_CONNECTION_LOST";
    failure.errno = 2013;
    const query = vi.fn().mockRejectedValue(failure);
    const fakePool = { query } as unknown as MysqlPoolType;
    const pool = new MysqlPool(fakePool, "app");
    await expect(pool.fetchSchema("app")).rejects.toBeInstanceOf(DbError);
  });

  it("rejects invalid schema names without issuing queries", async () => {
    const { fakePool, query } = buildPool({});
    const pool = new MysqlPool(fakePool, "app");
    await expect(pool.fetchSchema('"; DROP TABLE users; --')).rejects.toThrow(
      /schema/i
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe("mysqlPool.execute", () => {
  const buildExecutePool = (
    rows: unknown[][],
    fields: { name: string; columnType?: number }[]
  ) => {
    const query = vi.fn().mockResolvedValue([rows, fields]);
    const release = vi.fn();
    const destroy = vi.fn();
    const conn = { destroy, query, release };
    const fakePool = {
      getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as MysqlPoolType;
    return { conn, destroy, fakePool, query, release };
  };

  it("returns columns mapped through type codes", async () => {
    const { fakePool } = buildExecutePool(
      [[1, "alice"]],
      [
        { columnType: 3, name: "id" },
        { columnType: 253, name: "name" },
      ]
    );
    const pool = new MysqlPool(fakePool, "app");
    const result = tabular(
      await pool.execute(
        "SELECT id, name FROM users",
        100,
        null,
        new AbortController().signal
      )
    );
    expect(result.columns).toStrictEqual([
      { name: "id", typeName: "LONG" },
      { name: "name", typeName: "VAR_STRING" },
    ]);
    expect(result.rows).toStrictEqual([[1, "alice"]]);
    expect(result.rowCount).toBe(1);
    expect(result.isTruncated).toBeFalsy();
  });

  it("truncates rows beyond maxRows and flags isTruncated", async () => {
    const { fakePool } = buildExecutePool(
      [[1], [2], [3], [4], [5]],
      [{ columnType: 3, name: "id" }]
    );
    const pool = new MysqlPool(fakePool, "app");
    const result = tabular(
      await pool.execute(
        "SELECT id FROM big",
        2,
        null,
        new AbortController().signal
      )
    );
    expect(result.rows).toStrictEqual([[1], [2]]);
    expect(result.isTruncated).toBeTruthy();
    expect(result.rowCount).toBe(2);
  });

  it("jsonifies bigints, dates, and buffers in rows", async () => {
    const date = new Date("2024-01-02T03:04:05.000Z");
    const { fakePool } = buildExecutePool(
      [[10n, date, Buffer.from("abcd", "hex")]],
      [
        { columnType: 8, name: "big" },
        { columnType: 12, name: "ts" },
        { columnType: 252, name: "blob" },
      ]
    );
    const pool = new MysqlPool(fakePool, "app");
    const result = tabular(
      await pool.execute(
        "SELECT * FROM mixed",
        100,
        null,
        new AbortController().signal
      )
    );
    expect(result.rows[0]).toStrictEqual(["10", date.toISOString(), "0xabcd"]);
  });

  it("issues USE statements when a schema is provided and resets afterward", async () => {
    const { fakePool, query } = buildExecutePool(
      [[1]],
      [{ columnType: 3, name: "x" }]
    );
    const pool = new MysqlPool(fakePool, "app");
    await pool.execute(
      "SELECT 1 AS x",
      100,
      "warehouse",
      new AbortController().signal
    );
    const sqls = query.mock.calls.map((call) => sqlOf(call[0]));
    expect(sqls[0]).toBe("USE `warehouse`");
    expect(sqls.at(-1)).toBe("USE `app`");
  });

  it("rejects invalid schema names without issuing the query", async () => {
    const { fakePool, query } = buildExecutePool([], []);
    const pool = new MysqlPool(fakePool, "app");
    await expect(
      pool.execute(
        "SELECT 1",
        100,
        '"; DROP TABLE users; --',
        new AbortController().signal
      )
    ).rejects.toThrow(/schema/i);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("mysqlPool.execute cancellation", () => {
  const buildExecutePool = () => {
    const releaseCalls: ("destroy" | "soft")[] = [];
    let pendingReject: ((err: Error) => void) | null = null;

    const release = vi.fn(() => {
      releaseCalls.push("soft");
    });
    const destroy = vi.fn(() => {
      releaseCalls.push("destroy");
    });

    const query = vi.fn((input: unknown) => {
      if (
        typeof input === "object" &&
        input !== null &&
        "rowsAsArray" in (input as Record<string, unknown>)
      ) {
        const { promise, reject } = Promise.withResolvers<unknown>();
        pendingReject = reject;
        return promise;
      }
      return Promise.resolve([[], []]);
    });

    const conn = { destroy, query, release };
    const fakePool = {
      getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as MysqlPoolType;

    const fireAbort = (controller: AbortController) => {
      controller.abort(DbError.cancelled());
      pendingReject?.(new Error("Connection terminated"));
    };

    return { destroy, fakePool, fireAbort, release, releaseCalls };
  };

  it("destroys the connection exactly once when cancelled mid-query", async () => {
    const { fakePool, fireAbort, releaseCalls } = buildExecutePool();
    const pool = new MysqlPool(fakePool, "app");
    const controller = new AbortController();
    const promise = pool.execute(
      "SELECT SLEEP(60)",
      1000,
      null,
      controller.signal
    );
    await Promise.resolve();
    fireAbort(controller);
    await expect(promise).rejects.toBeInstanceOf(DbError);
    expect(releaseCalls).toStrictEqual(["destroy"]);
  });

  it("surfaces QUERY_CANCELLED when the user cancels", async () => {
    const { fakePool, fireAbort } = buildExecutePool();
    const pool = new MysqlPool(fakePool, "app");
    const controller = new AbortController();
    const promise = pool.execute("SELECT 1", 1000, null, controller.signal);
    await Promise.resolve();
    fireAbort(controller);
    const error = await promise.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("QUERY_CANCELLED");
  });

  it("releases (not destroys) on success", async () => {
    const release = vi.fn();
    const destroy = vi.fn();
    const query = vi.fn().mockResolvedValue([[[1]], [{ name: "x" }]]);
    const conn = { destroy, query, release };
    const fakePool = {
      getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as MysqlPoolType;
    const pool = new MysqlPool(fakePool, "app");
    await pool.execute("SELECT 1", 100, null, new AbortController().signal);
    expect(release).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();
  });
});

describe("mysqlPool.explain", () => {
  const buildExplainPool = (rawJson: string) => {
    const query = vi
      .fn<(sql: string) => Promise<[Record<string, unknown>[], unknown[]]>>()
      .mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (sql) =>
          sql.startsWith("EXPLAIN FORMAT=JSON")
            ? [[{ EXPLAIN: rawJson }], []]
            : [[], []]
      );
    const release = vi.fn();
    const destroy = vi.fn();
    const conn = { destroy, query, release };
    const fakePool = {
      getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as MysqlPoolType;
    return { fakePool, query, release };
  };

  it("parses a basic EXPLAIN FORMAT=JSON output", async () => {
    const planJson = JSON.stringify({
      query_block: {
        cost_info: { query_cost: "1.20" },
        select_id: 1,
        table: {
          access_type: "ALL",
          rows_examined_per_scan: 100,
          table_name: "users",
        },
      },
    });
    const { fakePool, query } = buildExplainPool(planJson);
    const pool = new MysqlPool(fakePool, "app");
    const result = await pool.explain(
      "SELECT * FROM users",
      false,
      null,
      new AbortController().signal
    );
    expect(result).toMatchObject({
      analyzeRan: false,
      engine: "mysql",
      supportsAnalyze: false,
    });
    expect(result.root.nodeType).toBe("Full Table Scan");
    expect(result.root.label).toBe("Full Table Scan on users");
    expect(query.mock.calls[0]?.[0]).toBe(
      "EXPLAIN FORMAT=JSON SELECT * FROM users"
    );
  });

  it("rejects EXPLAIN ANALYZE as unsupported", async () => {
    const { fakePool } = buildExplainPool("{}");
    const pool = new MysqlPool(fakePool, "app");
    const error = await pool
      .explain("SELECT * FROM users", true, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("UNSUPPORTED");
  });

  it("rejects empty SQL", async () => {
    const { fakePool } = buildExplainPool("{}");
    const pool = new MysqlPool(fakePool, "app");
    const error = await pool
      .explain("   ;;  ", false, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("EXPLAIN_EMPTY");
  });
});

describe("mapMysqlError", () => {
  it("passes through a DbError unchanged", () => {
    const err = new DbError("CUSTOM", "boom");
    expect(mapMysqlError(err)).toBe(err);
  });

  it("preserves mysql2 sqlMessage and code", () => {
    const native = Object.assign(new Error("ignored"), {
      code: "ER_PARSE_ERROR",
      errno: 1064,
      sqlMessage: "You have an error in your SQL syntax",
      sqlState: "42000",
    });
    const mapped = mapMysqlError(native);
    expect(mapped.code).toBe("ER_PARSE_ERROR");
    expect(mapped.message).toBe("You have an error in your SQL syntax");
  });

  it("synthesizes a code from errno when only errno is present", () => {
    const native = Object.assign(new Error("dropped"), { errno: 2013 });
    const mapped = mapMysqlError(native);
    expect(mapped.code).toBe("ER_2013");
  });

  it("unwraps single-error AggregateError", () => {
    const inner = Object.assign(new Error("inner"), { code: "ER_INNER" });
    const agg = new AggregateError([inner], "outer");
    const mapped = mapMysqlError(agg);
    expect(mapped.code).toBe("ER_INNER");
  });
});
