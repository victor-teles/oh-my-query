import type { ClickHouseClient } from "@clickhouse/client";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { ClickhousePool } from "./pool.ts";

interface QueryFixtures {
  tables?: unknown[];
  columns?: unknown[];
  indices?: unknown[];
}

const dispatchQuery = (query: string, fixtures: QueryFixtures): unknown[] => {
  if (query.includes("FROM system.tables")) {
    return fixtures.tables ?? [];
  }
  if (query.includes("FROM system.columns")) {
    return fixtures.columns ?? [];
  }
  if (query.includes("FROM system.data_skipping_indices")) {
    return fixtures.indices ?? [];
  }
  throw new Error(`Unexpected query in dispatch: ${query}`);
};

const buildClient = (fixtures: QueryFixtures) => {
  const query = vi
    .fn<
      (params: { query: string }) => Promise<{ json: () => Promise<unknown> }>
    >()
    // eslint-disable-next-line @typescript-eslint/require-await
    .mockImplementation(async ({ query: q }) => ({
      // eslint-disable-next-line @typescript-eslint/require-await
      json: async () => ({ data: dispatchQuery(q, fixtures) }),
    }));
  const fakeClient = { query } as unknown as ClickHouseClient;
  return { fakeClient, query };
};

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

const buildPool = (
  client: ClickHouseClient,
  database = "default",
  clientFor?: (db: string) => ClickHouseClient
): ClickhousePool =>
  new ClickhousePool({
    clientFor,
    defaultClient: client,
    defaultDatabase: database,
  });

describe("clickhousePool.fetchSchema", () => {
  it("issues exactly three schema-wide queries", async () => {
    const { fakeClient, query } = buildClient({});
    const pool = buildPool(fakeClient);
    const schema = await pool.fetchSchema("default");
    expect(query).toHaveBeenCalledTimes(3);
    expect(schema.schemas).toStrictEqual([
      { name: "default", tables: [], views: [] },
    ]);
  });

  it("separates tables from views by engine and parses row estimates", async () => {
    const { fakeClient } = buildClient({
      tables: [
        { engine: "MergeTree", name: "events", total_rows: "1234" },
        { engine: "View", name: "events_view", total_rows: null },
        { engine: "MaterializedView", name: "events_mv", total_rows: null },
      ],
    });
    const pool = buildPool(fakeClient);
    const result = await pool.fetchSchema("default");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables.map((t) => t.name)).toStrictEqual(["events"]);
    expect(schema.views.map((v) => v.name)).toStrictEqual([
      "events_view",
      "events_mv",
    ]);
    const eventsTable = must(schema.tables[0], "tables[0]");
    expect(eventsTable.rowEstimate).toBe(1234);
  });

  it("flags primary-key columns and unwraps Nullable types", async () => {
    const { fakeClient } = buildClient({
      columns: [
        {
          default_expression: "",
          is_in_primary_key: 1,
          name: "id",
          table: "events",
          type: "UInt64",
        },
        {
          default_expression: "",
          is_in_primary_key: 0,
          name: "payload",
          table: "events",
          type: "Nullable(String)",
        },
      ],
      tables: [{ engine: "MergeTree", name: "events", total_rows: "0" }],
    });
    const pool = buildPool(fakeClient);
    const result = await pool.fetchSchema("default");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.columns).toStrictEqual([
      {
        dataType: "UInt64",
        defaultValue: null,
        isNullable: false,
        isPrimaryKey: true,
        name: "id",
      },
      {
        dataType: "String",
        defaultValue: null,
        isNullable: true,
        isPrimaryKey: false,
        name: "payload",
      },
    ]);
  });

  it("attaches data-skipping indices to their tables", async () => {
    const { fakeClient } = buildClient({
      indices: [
        {
          expr: "user_id",
          index_type: "minmax",
          name: "events_user_idx",
          table: "events",
        },
      ],
      tables: [{ engine: "MergeTree", name: "events", total_rows: "0" }],
    });
    const pool = buildPool(fakeClient);
    const result = await pool.fetchSchema("default");
    const schema = must(result.schemas[0], "schemas[0]");
    const table = must(schema.tables[0], "tables[0]");
    expect(table.indexes).toStrictEqual([
      {
        columns: ["user_id"],
        isUnique: false,
        name: "events_user_idx",
      },
    ]);
  });

  it("populates view columns and leaves tables[] for views empty", async () => {
    const { fakeClient } = buildClient({
      columns: [
        {
          default_expression: "",
          is_in_primary_key: 0,
          name: "id",
          table: "live_events",
          type: "UInt64",
        },
      ],
      tables: [{ engine: "View", name: "live_events", total_rows: null }],
    });
    const pool = buildPool(fakeClient);
    const result = await pool.fetchSchema("default");
    const schema = must(result.schemas[0], "schemas[0]");
    expect(schema.tables).toStrictEqual([]);
    const view = must(schema.views[0], "views[0]");
    expect(view).toStrictEqual({
      columns: [
        {
          dataType: "UInt64",
          defaultValue: null,
          isNullable: false,
          isPrimaryKey: false,
          name: "id",
        },
      ],
      name: "live_events",
    });
  });

  it("returns an empty schema when no relations exist", async () => {
    const { fakeClient } = buildClient({});
    const pool = buildPool(fakeClient);
    const result = await pool.fetchSchema("default");
    expect(result).toStrictEqual({
      schemas: [{ name: "default", tables: [], views: [] }],
    });
  });

  it("wraps client failures in DbError", async () => {
    const failure = new Error("network down");
    const query = vi.fn().mockRejectedValue(failure);
    const fakeClient = { query } as unknown as ClickHouseClient;
    const pool = buildPool(fakeClient);
    await expect(pool.fetchSchema("default")).rejects.toBeInstanceOf(DbError);
  });

  it("rejects invalid database names without issuing queries", async () => {
    const { fakeClient, query } = buildClient({});
    const pool = buildPool(fakeClient);
    await expect(pool.fetchSchema('"; DROP DATABASE x; --')).rejects.toThrow(
      /schema/i
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe("clickhousePool.execute", () => {
  const buildExecuteClient = (rows: unknown[][]) => {
    const json = vi
      // eslint-disable-next-line @typescript-eslint/require-await
      .fn(async () => ({
        data: rows,
        meta: [{ name: "id", type: "UInt64" }],
        rows: rows.length,
      }));
    const query = vi
      // eslint-disable-next-line @typescript-eslint/require-await
      .fn(async () => ({ json }));
    const close = vi.fn(async () => {
      await Promise.resolve();
    });
    const client = { close, query } as unknown as ClickHouseClient;
    return { client, close, json, query };
  };

  it("uses the default client when schema matches the default database", async () => {
    const { client, query } = buildExecuteClient([[1]]);
    const factory = vi.fn();
    const pool = buildPool(client, "analytics", factory as never);
    const result = await pool.execute(
      "SELECT 1",
      100,
      "analytics",
      new AbortController().signal
    );
    expect(result.resultType).toBe("tabular");
    expect(query).toHaveBeenCalledOnce();
    expect(factory).not.toHaveBeenCalled();
  });

  it("creates and reuses a per-database client when schema differs", async () => {
    const { client: defaultClient } = buildExecuteClient([]);
    const { client: otherClient, query: otherQuery } = buildExecuteClient([
      [42],
    ]);
    const factory = vi.fn(() => otherClient);
    const pool = buildPool(defaultClient, "analytics", factory as never);

    await pool.execute("SELECT 1", 100, "logs", new AbortController().signal);
    await pool.execute("SELECT 2", 100, "logs", new AbortController().signal);

    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith("logs");
    expect(otherQuery).toHaveBeenCalledTimes(2);
  });

  it("close() shuts down both default and per-database clients", async () => {
    const { client: defaultClient, close: defaultClose } = buildExecuteClient(
      []
    );
    const { client: otherClient, close: otherClose } = buildExecuteClient([]);
    const pool = buildPool(
      defaultClient,
      "analytics",
      (() => otherClient) as never
    );

    await pool.execute("SELECT 1", 10, "logs", new AbortController().signal);
    await pool.close();

    expect(otherClose).toHaveBeenCalledOnce();
    expect(defaultClose).toHaveBeenCalledOnce();
  });
});
