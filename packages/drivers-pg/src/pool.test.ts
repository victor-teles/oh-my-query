import type { Pool as PgPoolType } from "pg";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { PostgresPool } from "./pool";

interface QueryRows {
  rows: Record<string, unknown>[];
}

interface QueryFixtures {
  relations?: QueryRows;
  columns?: QueryRows;
  indexes?: QueryRows;
  foreignKeys?: QueryRows;
}

const empty: QueryRows = { rows: [] };

const dispatchQuery = (sql: string, fixtures: QueryFixtures): QueryRows => {
  if (
    sql.includes("FROM pg_class") &&
    sql.includes("relkind IN ('r', 'p', 'v')")
  ) {
    return fixtures.relations ?? empty;
  }
  if (sql.includes("FROM information_schema.columns")) {
    return fixtures.columns ?? empty;
  }
  if (sql.includes("FROM pg_index")) {
    return fixtures.indexes ?? empty;
  }
  if (
    sql.includes("FROM information_schema.table_constraints") &&
    sql.includes("FOREIGN KEY")
  ) {
    return fixtures.foreignKeys ?? empty;
  }
  throw new Error(`Unexpected query in dispatch: ${sql}`);
};

const buildPool = (fixtures: QueryFixtures) => {
  const query = vi.fn<(sql: string) => Promise<QueryRows>>().mockImplementation(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (sql) => dispatchQuery(sql, fixtures)
  );
  const fakePool = { query } as unknown as PgPoolType;
  return { fakePool, query };
};

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

describe("postgresPool.fetchSchema", () => {
  it("issues exactly four schema-wide queries", async () => {
    const { fakePool, query } = buildPool({});
    const pool = new PostgresPool(fakePool);
    const schema = await pool.fetchSchema("public");
    expect(query).toHaveBeenCalledTimes(4);
    expect(schema.schemas).toStrictEqual([
      { name: "public", tables: [], views: [] },
    ]);
  });

  it("returns tables and views in alphabetical order with row estimates", async () => {
    const { fakePool } = buildPool({
      relations: {
        rows: [
          { kind: "r", name: "accounts", row_estimate: "10" },
          { kind: "v", name: "active_users", row_estimate: null },
          { kind: "r", name: "orders", row_estimate: "200" },
        ],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual([
      "accounts",
      "orders",
    ]);
    expect(schema.tables.map((t) => t.rowEstimate)).toStrictEqual([10, 200]);
    expect(schema.views.map((v) => v.name)).toStrictEqual(["active_users"]);
  });

  it("treats partitioned tables (relkind='p') as tables", async () => {
    const { fakePool } = buildPool({
      relations: {
        rows: [
          { kind: "p", name: "events_partitioned", row_estimate: null },
          { kind: "r", name: "users", row_estimate: "5" },
        ],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual([
      "events_partitioned",
      "users",
    ]);
    expect(schema.views).toStrictEqual([]);
  });

  it("flags primary key columns and leaves others unflagged", async () => {
    const { fakePool } = buildPool({
      columns: {
        rows: [
          {
            column_default: null,
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            is_pk: true,
            table_name: "users",
          },
          {
            column_default: null,
            column_name: "email",
            data_type: "text",
            is_nullable: "YES",
            is_pk: false,
            table_name: "users",
          },
        ],
      },
      relations: {
        rows: [{ kind: "r", name: "users", row_estimate: "0" }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.columns.map((c) => [c.name, c.isPrimaryKey])).toStrictEqual([
      ["id", true],
      ["email", false],
    ]);
    const email = must(table.columns[1], "columns[1]");
    expect(email.isNullable).toBeTruthy();
  });

  it("supports composite primary keys", async () => {
    const { fakePool } = buildPool({
      columns: {
        rows: [
          {
            column_default: null,
            column_name: "user_id",
            data_type: "integer",
            is_nullable: "NO",
            is_pk: true,
            table_name: "user_roles",
          },
          {
            column_default: null,
            column_name: "role_id",
            data_type: "integer",
            is_nullable: "NO",
            is_pk: true,
            table_name: "user_roles",
          },
        ],
      },
      relations: {
        rows: [{ kind: "r", name: "user_roles", row_estimate: "0" }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.columns.every((c) => c.isPrimaryKey)).toBeTruthy();
  });

  it("preserves multi-column index ordering", async () => {
    const { fakePool } = buildPool({
      indexes: {
        rows: [
          {
            columns: ["created_at", "user_id"],
            index_name: "events_created_user_idx",
            is_unique: false,
            table_name: "events",
          },
        ],
      },
      relations: {
        rows: [{ kind: "r", name: "events", row_estimate: "0" }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    const idx = must(table.indexes[0], "indexes[0]");
    expect(idx.columns).toStrictEqual(["created_at", "user_id"]);
    expect(idx.isUnique).toBeFalsy();
  });

  it("returns expression-only indexes with placeholder columns", async () => {
    const { fakePool } = buildPool({
      indexes: {
        rows: [
          {
            columns: ["(expression)"],
            index_name: "posts_lower_title_idx",
            is_unique: false,
            table_name: "posts",
          },
        ],
      },
      relations: {
        rows: [{ kind: "r", name: "posts", row_estimate: "0" }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    const idx = must(table.indexes[0], "indexes[0]");
    expect(idx.columns).toStrictEqual(["(expression)"]);
  });

  it("groups multi-column foreign keys under a single constraint", async () => {
    const { fakePool } = buildPool({
      foreignKeys: {
        rows: [
          {
            column_name: "tenant_id",
            constraint_name: "orders_tenant_user_fk",
            referenced_column: "tenant_id",
            referenced_table: "users",
            table_name: "orders",
          },
          {
            column_name: "user_id",
            constraint_name: "orders_tenant_user_fk",
            referenced_column: "id",
            referenced_table: "users",
            table_name: "orders",
          },
        ],
      },
      relations: {
        rows: [{ kind: "r", name: "orders", row_estimate: "0" }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
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

  it("populates view columns and excludes index/FK fields", async () => {
    const { fakePool } = buildPool({
      columns: {
        rows: [
          {
            column_default: null,
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            is_pk: false,
            table_name: "active_users",
          },
        ],
      },
      relations: {
        rows: [{ kind: "v", name: "active_users", row_estimate: null }],
      },
    });
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.views[0]).toStrictEqual({
      columns: [
        {
          dataType: "integer",
          defaultValue: null,
          isNullable: false,
          isPrimaryKey: false,
          name: "id",
        },
      ],
      name: "active_users",
    });
  });

  it("returns an empty schema when no relations exist", async () => {
    const { fakePool } = buildPool({});
    const pool = new PostgresPool(fakePool);
    const result = await pool.fetchSchema("public");
    expect(result).toStrictEqual({
      schemas: [{ name: "public", tables: [], views: [] }],
    });
  });

  it("wraps pool failures in DbError", async () => {
    const failure = new Error("connection terminated") as Error & {
      code?: string;
    };
    failure.code = "ECONNRESET";
    const query = vi.fn().mockRejectedValue(failure);
    const fakePool = { query } as unknown as PgPoolType;
    const pool = new PostgresPool(fakePool);
    await expect(pool.fetchSchema("public")).rejects.toBeInstanceOf(DbError);
  });

  it("rejects invalid schema names without issuing queries", async () => {
    const { fakePool, query } = buildPool({});
    const pool = new PostgresPool(fakePool);
    await expect(pool.fetchSchema('"; DROP TABLE users; --')).rejects.toThrow(
      /schema/i
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe("postgresPool.execute cancellation", () => {
  const buildExecutePool = () => {
    const releaseCalls: ("destroy" | "soft")[] = [];
    let pendingReject: ((err: Error) => void) | null = null;

    const release = vi.fn((destroy?: boolean) => {
      const kind = destroy ? "destroy" : "soft";
      if (releaseCalls.length > 0) {
        // Simulate pg-pool's actual behavior: throws on double release.
        throw new Error(
          "Release called on client which has already been released to the pool."
        );
      }
      releaseCalls.push(kind);
    });

    const query = vi.fn((input: unknown) => {
      if (
        typeof input === "object" &&
        input !== null &&
        "rowMode" in (input as Record<string, unknown>)
      ) {
        const { promise, reject } = Promise.withResolvers<unknown>();
        pendingReject = reject;
        return promise;
      }
      return Promise.resolve({ fields: [], rows: [] });
    });

    const client = { query, release };
    const fakePool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as PgPoolType;

    const fireAbort = (controller: AbortController) => {
      controller.abort(DbError.cancelled());
      // pg destroys the client; the in-flight query rejects.
      pendingReject?.(new Error("Connection terminated"));
    };

    return { fakePool, fireAbort, release, releaseCalls };
  };

  it("releases the client exactly once when cancelled mid-query", async () => {
    const { fakePool, fireAbort, releaseCalls } = buildExecutePool();
    const pool = new PostgresPool(fakePool);
    const controller = new AbortController();
    const promise = pool.execute(
      "SELECT pg_sleep(60)",
      1000,
      null,
      controller.signal
    );
    // Let microtasks settle so the query is in-flight.
    await Promise.resolve();
    fireAbort(controller);
    await expect(promise).rejects.toBeInstanceOf(DbError);
    expect(releaseCalls).toStrictEqual(["destroy"]);
  });

  it("surfaces QUERY_CANCELLED when the user cancels", async () => {
    const { fakePool, fireAbort } = buildExecutePool();
    const pool = new PostgresPool(fakePool);
    const controller = new AbortController();
    const promise = pool.execute("SELECT 1", 1000, null, controller.signal);
    await Promise.resolve();
    fireAbort(controller);
    const error = await promise.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).code).toBe("QUERY_CANCELLED");
  });

  it("does not surface 'already released' to the caller", async () => {
    const { fakePool, fireAbort } = buildExecutePool();
    const pool = new PostgresPool(fakePool);
    const controller = new AbortController();
    const promise = pool.execute("SELECT 1", 1000, null, controller.signal);
    await Promise.resolve();
    fireAbort(controller);
    const error = await promise.catch((error: unknown) => error);
    expect((error as Error).message).not.toMatch(/already been released/);
  });
});
