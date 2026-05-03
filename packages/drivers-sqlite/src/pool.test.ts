import type { ExecuteResult, TabularResult } from "@oh-my-query/core";
import type { Database } from "bun:sqlite";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { mapSqliteError, SqlitePool } from "./pool.ts";

const tabular = (r: ExecuteResult): TabularResult => {
  expect(r.resultType).toBe("tabular");
  return r as TabularResult;
};

const abort = () => new AbortController().signal;

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

interface FakeStatement {
  columnNames: string[];
  columnTypes: (string | null)[];
  all: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
}

interface QueryFixture {
  columnNames?: string[];
  columnTypes?: (string | null)[];
  rows?: unknown[][];
  objects?: Record<string, unknown>[];
  changes?: { changes: number; lastInsertRowid: number };
  throws?: Error;
}

interface Fixtures {
  version?: { rows: { sqlite_version?: string }[] };
  databases?: { rows: { seq: number; name: string; file: string }[] };
  relations?: QueryFixture;
  columns?: QueryFixture;
  indexes?: QueryFixture;
  indexInfo?: Record<string, QueryFixture>;
  foreignKeys?: QueryFixture;
  arbitrary?: QueryFixture;
}

const buildStatement = (fix?: QueryFixture): FakeStatement => {
  const f = fix ?? {};
  const objects = f.objects ?? [];
  const rows = f.rows ?? [];
  const columnNames = f.columnNames ?? [];
  const columnTypes = f.columnTypes ?? [];
  const stmt: FakeStatement = {
    all: vi.fn(() => {
      if (f.throws) {
        throw f.throws;
      }
      if (f.objects) {
        return objects;
      }
      return rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < columnNames.length; i += 1) {
          const name = columnNames[i];
          if (name) {
            obj[name] = row[i];
          }
        }
        return obj;
      });
    }),
    columnNames,
    columnTypes,
    finalize: vi.fn(),
    get: vi.fn(() => {
      if (f.throws) {
        throw f.throws;
      }
      return objects[0] ?? null;
    }),
    run: vi.fn(() => {
      if (f.throws) {
        throw f.throws;
      }
      return f.changes ?? { changes: 0, lastInsertRowid: 0 };
    }),
    values: vi.fn(() => {
      if (f.throws) {
        throw f.throws;
      }
      return rows;
    }),
  };
  return stmt;
};

const buildPool = (fixtures: Fixtures = {}) => {
  const fakeStmts: { sql: string; stmt: FakeStatement }[] = [];

  const dispatch = (sql: string): FakeStatement => {
    if (/sqlite_version\s*\(/i.test(sql)) {
      return buildStatement({
        columnNames: ["sqlite_version"],
        columnTypes: ["TEXT"],
        objects: fixtures.version?.rows ?? [],
        rows: (fixtures.version?.rows ?? []).map((r) => [r.sqlite_version]),
      });
    }
    if (/database_list/i.test(sql)) {
      return buildStatement({
        columnNames: ["seq", "name", "file"],
        columnTypes: ["INTEGER", "TEXT", "TEXT"],
        objects: fixtures.databases?.rows ?? [],
      });
    }
    if (/sqlite_master/i.test(sql)) {
      return buildStatement(fixtures.relations);
    }
    if (/pragma_table_info/i.test(sql)) {
      return buildStatement(fixtures.columns);
    }
    if (/pragma_index_list/i.test(sql)) {
      return buildStatement(fixtures.indexes);
    }
    if (/pragma_index_info/i.test(sql)) {
      const stmt = buildStatement();
      stmt.all.mockImplementation((idxName?: string) => {
        const fix = fixtures.indexInfo?.[idxName ?? ""];
        return fix?.objects ?? [];
      });
      return stmt;
    }
    if (/pragma_foreign_key_list/i.test(sql)) {
      return buildStatement(fixtures.foreignKeys);
    }
    return buildStatement(fixtures.arbitrary);
  };

  const query = vi.fn((sql: string): FakeStatement => {
    const stmt = dispatch(sql);
    fakeStmts.push({ sql, stmt });
    return stmt;
  });

  const close = vi.fn();

  const db = { close, query } as unknown as Database;
  const pool = new SqlitePool(db, "sqlite");
  return { close, db, fakeStmts, pool, query };
};

describe("sqlitePool > metadata", () => {
  it("identifies as sqlite dialect with no explain support", () => {
    const { pool } = buildPool();
    expect(pool.dialect).toBe("sqlite");
    expect(pool.supportsExplain).toBeFalsy();
  });

  it("fetchVersion prefixes with 'SQLite' and returns the parsed value", async () => {
    const { pool, query } = buildPool({
      version: { rows: [{ sqlite_version: "3.45.0" }] },
    });
    await expect(pool.fetchVersion()).resolves.toBe("SQLite 3.45.0");
    expect(query.mock.calls[0]?.[0]).toMatch(/sqlite_version/i);
  });

  it("fetchVersion returns empty string when no row is returned", async () => {
    const { pool } = buildPool({ version: { rows: [] } });
    await expect(pool.fetchVersion()).resolves.toBe("");
  });

  it("fetchVersion wraps native errors in DbError", async () => {
    const { pool, query } = buildPool();
    query.mockImplementationOnce(() => {
      throw new Error("io error");
    });
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("io error");
  });

  it("listDatabases returns names from PRAGMA database_list", async () => {
    const { pool } = buildPool({
      databases: {
        rows: [
          { file: "", name: "main", seq: 0 },
          { file: "/tmp/aux.db", name: "auxdb", seq: 2 },
        ],
      },
    });
    await expect(pool.listDatabases()).resolves.toStrictEqual([
      "main",
      "auxdb",
    ]);
  });

  it("listDatabases falls back to ['main'] when the pragma rejects", async () => {
    const { pool, query } = buildPool();
    query.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    await expect(pool.listDatabases()).resolves.toStrictEqual(["main"]);
  });
});

describe("sqlitePool > fetchSchema", () => {
  it("returns an empty schema when no relations exist", async () => {
    const { pool } = buildPool();
    const r = await pool.fetchSchema("main");
    expect(r).toStrictEqual({
      schemas: [{ name: "main", tables: [], views: [] }],
    });
  });

  it("groups tables and views and populates view columns", async () => {
    const { pool } = buildPool({
      columns: {
        objects: [
          {
            cid: 0,
            dflt_value: null,
            name: "id",
            notnull: 1,
            pk: 1,
            type: "INTEGER",
          },
          {
            cid: 0,
            dflt_value: null,
            name: "label",
            notnull: 0,
            pk: 0,
            type: "TEXT",
          },
        ],
      },
      relations: {
        objects: [
          { name: "users", type: "table" },
          { name: "active_users", type: "view" },
        ],
      },
    });
    const r = await pool.fetchSchema("main");
    const schema = must(r.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual(["users"]);
    expect(schema.views.map((v) => v.name)).toStrictEqual(["active_users"]);
    const usersTable = must(schema.tables[0], "tables[0]");
    expect(
      usersTable.columns.map((c) => [c.name, c.isPrimaryKey])
    ).toContainEqual(["id", true]);
  });

  it("flags primary-key columns and nullability from pragma_table_info", async () => {
    const { pool } = buildPool({
      columns: {
        objects: [
          {
            cid: 0,
            dflt_value: null,
            name: "id",
            notnull: 1,
            pk: 1,
            type: "INTEGER",
          },
          {
            cid: 1,
            dflt_value: null,
            name: "email",
            notnull: 0,
            pk: 0,
            type: "TEXT",
          },
        ],
      },
      relations: { objects: [{ name: "users", type: "table" }] },
    });
    const r = await pool.fetchSchema("main");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.columns).toStrictEqual([
      {
        dataType: "INTEGER",
        defaultValue: null,
        isNullable: false,
        isPrimaryKey: true,
        name: "id",
      },
      {
        dataType: "TEXT",
        defaultValue: null,
        isNullable: true,
        isPrimaryKey: false,
        name: "email",
      },
    ]);
  });

  it("collects indexes via pragma_index_list/info, skipping primary-key origin", async () => {
    const { pool } = buildPool({
      indexInfo: {
        idx_email: { objects: [{ cid: 1, name: "email", seqno: 0 }] },
      },
      indexes: {
        objects: [
          { name: "idx_email", origin: "c", partial: 0, seq: 0, unique: 1 },
          {
            name: "sqlite_autoindex_users_1",
            origin: "pk",
            partial: 0,
            seq: 1,
            unique: 1,
          },
        ],
      },
      relations: { objects: [{ name: "users", type: "table" }] },
    });
    const r = await pool.fetchSchema("main");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.indexes).toStrictEqual([
      { columns: ["email"], isUnique: true, name: "idx_email" },
    ]);
  });

  it("collects multi-column foreign keys via pragma_foreign_key_list", async () => {
    const { pool } = buildPool({
      foreignKeys: {
        objects: [
          { from: "tenant_id", id: 0, seq: 0, table: "tenants", to: "id" },
          { from: "user_id", id: 0, seq: 1, table: "tenants", to: "user_id" },
          { from: "category_id", id: 1, seq: 0, table: "categories", to: "id" },
        ],
      },
      relations: { objects: [{ name: "orders", type: "table" }] },
    });
    const r = await pool.fetchSchema("main");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.foreignKeys).toHaveLength(2);
    expect(table.foreignKeys[0]).toStrictEqual({
      columns: ["tenant_id", "user_id"],
      name: "orders_fk_0",
      referencedColumns: ["id", "user_id"],
      referencedTable: "tenants",
    });
    expect(table.foreignKeys[1]).toStrictEqual({
      columns: ["category_id"],
      name: "orders_fk_1",
      referencedColumns: ["id"],
      referencedTable: "categories",
    });
  });

  it("rejects invalid schema names without issuing queries", async () => {
    const { pool, query } = buildPool();
    await expect(
      pool.fetchSchema('"; DROP TABLE x; --')
    ).rejects.toBeInstanceOf(DbError);
    expect(query).not.toHaveBeenCalled();
  });

  it("wraps native errors in DbError", async () => {
    const { pool, query } = buildPool();
    query.mockImplementationOnce(() => {
      throw new Error("catalog unavailable");
    });
    const err = await pool.fetchSchema("main").catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("catalog unavailable");
  });
});

describe("sqlitePool > execute", () => {
  it("returns rows and column metadata for a SELECT", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columnNames: ["n"],
        columnTypes: ["INTEGER"],
        rows: [[1]],
      },
    });
    const r = tabular(await pool.execute("SELECT 1 AS n", 100, null, abort()));
    expect(r.columns).toStrictEqual([{ name: "n", typeName: "INTEGER" }]);
    expect(r.rows).toStrictEqual([[1]]);
    expect(r.isTruncated).toBeFalsy();
    expect(r.rowCount).toBe(1);
  });

  it("truncates rows past maxRows and flags isTruncated", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columnNames: ["v"],
        columnTypes: ["INTEGER"],
        rows: [[1], [2], [3], [4], [5]],
      },
    });
    const r = tabular(
      await pool.execute("SELECT v FROM big", 3, null, abort())
    );
    expect(r.rows).toStrictEqual([[1], [2], [3]]);
    expect(r.isTruncated).toBeTruthy();
    expect(r.rowCount).toBe(3);
  });

  it("returns rowCount and empty rows for a non-SELECT", async () => {
    const { pool } = buildPool({
      arbitrary: {
        changes: { changes: 4, lastInsertRowid: 7 },
        columnNames: [],
        columnTypes: [],
      },
    });
    const r = tabular(
      await pool.execute("DELETE FROM users", 100, null, abort())
    );
    expect(r.columns).toStrictEqual([]);
    expect(r.rows).toStrictEqual([]);
    expect(r.rowCount).toBe(4);
    expect(r.isTruncated).toBeFalsy();
  });

  it("coerces bigint cell values to strings", async () => {
    const { pool } = buildPool({
      arbitrary: {
        columnNames: ["big"],
        columnTypes: ["INTEGER"],
        rows: [[9_007_199_254_740_993n]],
      },
    });
    const r = tabular(await pool.execute("SELECT big", 10, null, abort()));
    expect(r.rows).toStrictEqual([["9007199254740993"]]);
  });

  it("rejects with QUERY_CANCELLED when aborted before execute", async () => {
    const { pool } = buildPool();
    const ctrl = new AbortController();
    ctrl.abort(DbError.cancelled());
    const err = await pool
      .execute("SELECT 1", 10, null, ctrl.signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("QUERY_CANCELLED");
  });

  it("wraps native errors in DbError", async () => {
    const { pool, query } = buildPool();
    query.mockImplementationOnce(() => {
      throw new Error("syntax error near 'WHEER'");
    });
    const err = await pool
      .execute("SELECT WHEER 1", 10, null, abort())
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("syntax error near 'WHEER'");
  });
});

describe("sqlitePool > explain", () => {
  it("rejects with UNSUPPORTED", async () => {
    const { pool } = buildPool();
    const err = await pool
      .explain("SELECT 1", false, null, abort())
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED");
  });
});

describe("sqlitePool > close", () => {
  it("calls db.close()", async () => {
    const { close, pool } = buildPool();
    await pool.close();
    expect(close).toHaveBeenCalledWith();
  });

  it("makes subsequent operations fail with POOL_CLOSED", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });

  it("is idempotent — second close is a no-op", async () => {
    const { close, pool } = buildPool();
    await pool.close();
    await expect(pool.close()).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("mapSqliteError", () => {
  it("returns DbError instances unchanged", () => {
    const original = new DbError("FOO", "bar");
    expect(mapSqliteError(original)).toBe(original);
  });

  it("wraps a generic Error into DbError with DB_ERROR code", () => {
    const wrapped = mapSqliteError(new Error("boom"));
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.code).toBe("DB_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("preserves err.code when present (e.g. SQLITE_BUSY)", () => {
    const sqliteErr = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });
    const wrapped = mapSqliteError(sqliteErr);
    expect(wrapped.code).toBe("SQLITE_BUSY");
    expect(wrapped.message).toBe("database is locked");
  });

  it("falls back to error name when message is missing", () => {
    const wrapped = mapSqliteError({ name: "WeirdError" });
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("WeirdError");
  });

  it("stringifies non-Error values", () => {
    const wrapped = mapSqliteError(42);
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("42");
  });
});
