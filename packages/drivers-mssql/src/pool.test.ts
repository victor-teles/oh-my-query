import type { ExecuteResult, TabularResult } from "@oh-my-query/core";
import type { ConnectionPool, IColumnMetadata, IResult } from "mssql";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { mapMssqlError, MssqlPool } from "./pool.ts";

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

interface FakeRequest {
  query: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
}

interface QueryFixture {
  recordset?: Record<string, unknown>[];
  columns?: IColumnMetadata;
  rowsAffected?: number[];
  throws?: Error;
}

interface Fixtures {
  version?: { value: string | null };
  databases?: { rows: { name: string }[] };
  relations?: QueryFixture;
  columns?: QueryFixture;
  indexes?: QueryFixture;
  foreignKeys?: QueryFixture;
  arbitrary?: QueryFixture;
}

const buildResult = (fix?: QueryFixture): IResult<unknown> => {
  const f = fix ?? {};
  const recordset = (f.recordset ?? []) as Record<string, unknown>[];
  const cast = recordset as unknown as IResult<unknown>["recordset"];
  cast.columns = f.columns ?? ({} as IColumnMetadata);
  return {
    output: {},
    recordset: cast,
    recordsets: [cast] as unknown as IResult<unknown>["recordsets"],
    rowsAffected: f.rowsAffected ?? [recordset.length],
  };
};

const buildPool = (fixtures: Fixtures = {}) => {
  const dispatch = (sql: string): IResult<unknown> => {
    if (/@@VERSION/i.test(sql)) {
      const v = fixtures.version?.value;
      const recordset = v === null ? [] : [{ version: v ?? "" }];
      return buildResult({ recordset });
    }
    if (/sys\.databases/i.test(sql)) {
      return buildResult({ recordset: fixtures.databases?.rows ?? [] });
    }
    if (/INFORMATION_SCHEMA\.TABLES/i.test(sql)) {
      return buildResult(fixtures.relations);
    }
    if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sql)) {
      return buildResult(fixtures.columns);
    }
    if (/sys\.indexes/i.test(sql)) {
      return buildResult(fixtures.indexes);
    }
    if (/sys\.foreign_keys/i.test(sql)) {
      return buildResult(fixtures.foreignKeys);
    }
    return buildResult(fixtures.arbitrary);
  };

  const queryImpl = (sql: string): Promise<IResult<unknown>> => {
    if (sql.startsWith("USE ")) {
      return Promise.resolve(buildResult());
    }
    return Promise.resolve(dispatch(sql));
  };

  const query = vi.fn((sql: string) => queryImpl(sql));
  const close = vi.fn(async () => {
    await Promise.resolve();
  });

  const fakeRequest: FakeRequest = {
    cancel: vi.fn(),
    query: vi.fn((sql: string) => queryImpl(sql)),
  };
  const request = vi.fn(() => fakeRequest);

  const pool = {
    close,
    query,
    request,
  } as unknown as ConnectionPool;
  const mssqlPool = new MssqlPool(pool, "appdb");
  return { close, fakeRequest, mssqlPool, pool, query, request };
};

describe("mssqlPool > metadata", () => {
  it("identifies as tsql dialect with no explain support", () => {
    const { mssqlPool } = buildPool();
    expect(mssqlPool.dialect).toBe("tsql");
    expect(mssqlPool.supportsExplain).toBeFalsy();
  });

  it("fetchVersion returns the first line of @@VERSION", async () => {
    const { mssqlPool } = buildPool({
      version: {
        value:
          "Microsoft SQL Server 2022 (RTM-CU13) (KB5046061)\n\tNov 14 2024 ...",
      },
    });
    await expect(mssqlPool.fetchVersion()).resolves.toBe(
      "Microsoft SQL Server 2022 (RTM-CU13) (KB5046061)"
    );
  });

  it("fetchVersion returns empty string when no row is returned", async () => {
    const { mssqlPool } = buildPool({ version: { value: null } });
    await expect(mssqlPool.fetchVersion()).resolves.toBe("");
  });

  it("fetchVersion wraps native errors in DbError", async () => {
    const { mssqlPool, query } = buildPool();
    query.mockRejectedValueOnce(new Error("connection lost"));
    const err = await mssqlPool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("connection lost");
  });

  it("listDatabases returns names from sys.databases excluding system DBs", async () => {
    const { mssqlPool, query } = buildPool({
      databases: { rows: [{ name: "appdb" }, { name: "reporting" }] },
    });
    await expect(mssqlPool.listDatabases()).resolves.toStrictEqual([
      "appdb",
      "reporting",
    ]);
    const sql = must(query.mock.calls[0]?.[0], "first query sql");
    expect(sql).toMatch(/sys\.databases/i);
    expect(sql).toMatch(/master/i);
  });

  it("listDatabases wraps errors in DbError", async () => {
    const { mssqlPool, query } = buildPool();
    query.mockRejectedValueOnce(new Error("permission denied"));
    const err = await mssqlPool
      .listDatabases()
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("permission denied");
  });
});

describe("mssqlPool > fetchSchema", () => {
  it("returns an empty schema when no relations exist", async () => {
    const { mssqlPool } = buildPool({});
    const r = await mssqlPool.fetchSchema("appdb");
    expect(r).toStrictEqual({
      schemas: [{ name: "appdb", tables: [], views: [] }],
    });
  });

  it("groups tables and views by TABLE_TYPE", async () => {
    const { mssqlPool } = buildPool({
      relations: {
        recordset: [
          { TABLE_NAME: "users", TABLE_TYPE: "BASE TABLE" },
          { TABLE_NAME: "active_users", TABLE_TYPE: "VIEW" },
          { TABLE_NAME: "orders", TABLE_TYPE: "BASE TABLE" },
        ],
      },
    });
    const r = await mssqlPool.fetchSchema("appdb");
    const schema = must(r.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual(["users", "orders"]);
    expect(schema.views.map((v) => v.name)).toStrictEqual(["active_users"]);
  });

  it("populates column metadata with primary-key flag and nullability", async () => {
    const { mssqlPool } = buildPool({
      columns: {
        recordset: [
          {
            COLUMN_DEFAULT: null,
            COLUMN_NAME: "id",
            DATA_TYPE: "int",
            IS_NULLABLE: "NO",
            IS_PRIMARY_KEY: 1,
            TABLE_NAME: "users",
          },
          {
            COLUMN_DEFAULT: null,
            COLUMN_NAME: "email",
            DATA_TYPE: "nvarchar",
            IS_NULLABLE: "YES",
            IS_PRIMARY_KEY: 0,
            TABLE_NAME: "users",
          },
        ],
      },
      relations: {
        recordset: [{ TABLE_NAME: "users", TABLE_TYPE: "BASE TABLE" }],
      },
    });
    const r = await mssqlPool.fetchSchema("appdb");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.columns).toStrictEqual([
      {
        dataType: "int",
        defaultValue: null,
        isNullable: false,
        isPrimaryKey: true,
        name: "id",
      },
      {
        dataType: "nvarchar",
        defaultValue: null,
        isNullable: true,
        isPrimaryKey: false,
        name: "email",
      },
    ]);
  });

  it("groups index columns by index_name and respects is_unique", async () => {
    const { mssqlPool } = buildPool({
      indexes: {
        recordset: [
          {
            COLUMN_NAME: "email",
            INDEX_NAME: "idx_users_email",
            IS_UNIQUE: 1,
            KEY_ORDINAL: 1,
            TABLE_NAME: "users",
          },
          {
            COLUMN_NAME: "tenant_id",
            INDEX_NAME: "idx_users_tenant_status",
            IS_UNIQUE: 0,
            KEY_ORDINAL: 1,
            TABLE_NAME: "users",
          },
          {
            COLUMN_NAME: "status",
            INDEX_NAME: "idx_users_tenant_status",
            IS_UNIQUE: 0,
            KEY_ORDINAL: 2,
            TABLE_NAME: "users",
          },
        ],
      },
      relations: {
        recordset: [{ TABLE_NAME: "users", TABLE_TYPE: "BASE TABLE" }],
      },
    });
    const r = await mssqlPool.fetchSchema("appdb");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.indexes).toStrictEqual([
      { columns: ["email"], isUnique: true, name: "idx_users_email" },
      {
        columns: ["tenant_id", "status"],
        isUnique: false,
        name: "idx_users_tenant_status",
      },
    ]);
  });

  it("groups foreign-key columns by constraint_name", async () => {
    const { mssqlPool } = buildPool({
      foreignKeys: {
        recordset: [
          {
            COLUMN_NAME: "tenant_id",
            CONSTRAINT_NAME: "fk_orders_tenant",
            ORDINAL: 1,
            REFERENCED_COLUMN_NAME: "id",
            REFERENCED_TABLE_NAME: "tenants",
            TABLE_NAME: "orders",
          },
          {
            COLUMN_NAME: "user_id",
            CONSTRAINT_NAME: "fk_orders_tenant",
            ORDINAL: 2,
            REFERENCED_COLUMN_NAME: "user_id",
            REFERENCED_TABLE_NAME: "tenants",
            TABLE_NAME: "orders",
          },
        ],
      },
      relations: {
        recordset: [{ TABLE_NAME: "orders", TABLE_TYPE: "BASE TABLE" }],
      },
    });
    const r = await mssqlPool.fetchSchema("appdb");
    const table = must(r.schemas[0]?.tables[0], "tables[0]");
    expect(table.foreignKeys).toStrictEqual([
      {
        columns: ["tenant_id", "user_id"],
        name: "fk_orders_tenant",
        referencedColumns: ["id", "user_id"],
        referencedTable: "tenants",
      },
    ]);
  });

  it("rejects invalid schema names without issuing queries", async () => {
    const { mssqlPool, query } = buildPool();
    await expect(
      mssqlPool.fetchSchema('"; DROP TABLE x; --')
    ).rejects.toBeInstanceOf(DbError);
    expect(query).not.toHaveBeenCalled();
  });

  it("wraps native errors in DbError", async () => {
    const { mssqlPool, query } = buildPool();
    query.mockRejectedValueOnce(new Error("catalog unavailable"));
    const err = await mssqlPool
      .fetchSchema("appdb")
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("catalog unavailable");
  });
});

describe("mssqlPool > execute", () => {
  it("returns rows and column metadata for a SELECT", async () => {
    const { mssqlPool } = buildPool({
      arbitrary: {
        columns: {
          n: {
            caseSensitive: false,
            identity: false,
            index: 0,
            length: 4,
            name: "n",
            nullable: false,
            readOnly: false,
            type: () => ({ type: { declaration: "int" } as never }),
          },
        } as unknown as IColumnMetadata,
        recordset: [{ n: 1 }],
      },
    });
    const r = tabular(
      await mssqlPool.execute("SELECT 1 AS n", 100, null, abort())
    );
    expect(r.columns).toStrictEqual([{ name: "n", typeName: "int" }]);
    expect(r.rows).toStrictEqual([[1]]);
    expect(r.isTruncated).toBeFalsy();
    expect(r.rowCount).toBe(1);
  });

  it("truncates rows past maxRows and flags isTruncated", async () => {
    const { mssqlPool } = buildPool({
      arbitrary: {
        columns: {
          v: {
            caseSensitive: false,
            identity: false,
            index: 0,
            length: 4,
            name: "v",
            nullable: false,
            readOnly: false,
            type: () => ({ type: { declaration: "int" } as never }),
          },
        } as unknown as IColumnMetadata,
        recordset: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
      },
    });
    const r = tabular(
      await mssqlPool.execute("SELECT v FROM big", 3, null, abort())
    );
    expect(r.rows).toStrictEqual([[1], [2], [3]]);
    expect(r.isTruncated).toBeTruthy();
    expect(r.rowCount).toBe(3);
  });

  it("returns rowCount from rowsAffected for non-SELECT (no recordset)", async () => {
    const { mssqlPool, fakeRequest } = buildPool();
    fakeRequest.query.mockResolvedValueOnce({
      output: {},
      recordset: undefined,
      recordsets: [],
      rowsAffected: [4],
    });
    const r = tabular(
      await mssqlPool.execute("DELETE FROM users", 100, null, abort())
    );
    expect(r.columns).toStrictEqual([]);
    expect(r.rows).toStrictEqual([]);
    expect(r.rowCount).toBe(4);
    expect(r.isTruncated).toBeFalsy();
  });

  it("issues USE [schema] when schema is provided", async () => {
    const { mssqlPool, fakeRequest } = buildPool({
      arbitrary: {
        columns: {} as unknown as IColumnMetadata,
        recordset: [],
      },
    });
    await mssqlPool.execute(
      "SELECT v FROM scoped_table",
      10,
      "scoped",
      abort()
    );
    expect(fakeRequest.query.mock.calls[0]?.[0]).toBe("USE [scoped]");
  });

  it("rejects invalid schema names without running any SQL", async () => {
    const { mssqlPool, fakeRequest } = buildPool();
    await expect(
      mssqlPool.execute("SELECT 1", 10, '"; DROP TABLE users; --', abort())
    ).rejects.toBeInstanceOf(DbError);
    expect(fakeRequest.query).not.toHaveBeenCalled();
  });

  it("rejects with QUERY_CANCELLED when aborted before execute", async () => {
    const { mssqlPool } = buildPool();
    const ctrl = new AbortController();
    ctrl.abort(DbError.cancelled());
    const err = await mssqlPool
      .execute("SELECT 1", 10, null, ctrl.signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("QUERY_CANCELLED");
  });

  it("cancels the request and rejects with QUERY_CANCELLED when aborted mid-flight", async () => {
    const { mssqlPool, fakeRequest } = buildPool();
    const pending = Promise.withResolvers<never>();
    fakeRequest.query.mockImplementationOnce(() => pending.promise);
    const ctrl = new AbortController();
    const promise = mssqlPool.execute("SELECT 1", 10, null, ctrl.signal);
    await Promise.resolve();
    ctrl.abort(DbError.cancelled());
    pending.reject(new Error("Request cancelled"));
    const err = await promise.catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("QUERY_CANCELLED");
    expect(fakeRequest.cancel).toHaveBeenCalledWith();
  });

  it("wraps native errors in DbError", async () => {
    const { mssqlPool, fakeRequest } = buildPool();
    fakeRequest.query.mockRejectedValueOnce(
      new Error("Invalid object name 'noo'.")
    );
    const err = await mssqlPool
      .execute("SELECT * FROM noo", 10, null, abort())
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("Invalid object name 'noo'.");
  });
});

describe("mssqlPool > explain", () => {
  it("rejects with UNSUPPORTED", async () => {
    const { mssqlPool } = buildPool();
    const err = await mssqlPool
      .explain("SELECT 1", false, null, abort())
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED");
  });
});

describe("mssqlPool > close", () => {
  it("calls pool.close()", async () => {
    const { close, mssqlPool } = buildPool();
    await mssqlPool.close();
    expect(close).toHaveBeenCalledWith();
  });

  it("makes subsequent operations fail with POOL_CLOSED", async () => {
    const { mssqlPool } = buildPool();
    await mssqlPool.close();
    const err = await mssqlPool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });

  it("is idempotent — second close is a no-op", async () => {
    const { close, mssqlPool } = buildPool();
    await mssqlPool.close();
    await expect(mssqlPool.close()).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("mapMssqlError", () => {
  it("returns DbError instances unchanged", () => {
    const original = new DbError("FOO", "bar");
    expect(mapMssqlError(original)).toBe(original);
  });

  it("wraps a generic Error into DbError with DB_ERROR code", () => {
    const wrapped = mapMssqlError(new Error("boom"));
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.code).toBe("DB_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("preserves err.code when present (e.g. ELOGIN)", () => {
    const errored = Object.assign(new Error("Login failed"), {
      code: "ELOGIN",
    });
    const wrapped = mapMssqlError(errored);
    expect(wrapped.code).toBe("ELOGIN");
    expect(wrapped.message).toBe("Login failed");
  });

  it("falls back to error name when message is missing", () => {
    const wrapped = mapMssqlError({ name: "WeirdError" });
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("WeirdError");
  });

  it("stringifies non-Error values", () => {
    const wrapped = mapMssqlError(42);
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("42");
  });
});
