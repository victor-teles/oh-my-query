import type {
  DatabaseConnection,
  ExecuteOptions,
  SchemaInfo,
  TableItem,
} from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type { LookupEvent, LookupEventMessage } from "@conch/rpc";

import { appendHistory, getConnections } from "@conch/core";
import { describe, expect, it, vi } from "vitest";

import type { LookupTiming } from "./lookup-service.ts";
import type { SchemaCache } from "./schema-cache.ts";

import { createLookupService } from "./lookup-service.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  appendHistory: vi.fn(),
  getConnections: vi.fn(),
}));

const UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";

const connection = (id: string, type = "postgresql"): DatabaseConnection => ({
  createdAt: "2026-11-18T00:00:00.000Z",
  database: "app",
  host: "127.0.0.1",
  id,
  lastConnectedAt: null,
  name: id,
  password: "secret",
  pinned: false,
  port: 5432,
  type,
  username: "conch",
});

const uuidTable = (name: string, column = "id"): TableItem => ({
  columns: [
    {
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: column === "id",
      name: column,
    },
  ],
  foreignKeys: [],
  indexes: [],
  name,
  rowEstimate: 100,
});

const SCHEMA: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        uuidTable("users"),
        uuidTable("orders", "user_id"),
        uuidTable("events", "actor_id"),
      ],
      views: [],
    },
  ],
};

const rowsResult = (count: number) => ({
  columns: [{ name: "?column?", typeName: "INT4" }],
  executionTimeMs: 1,
  isTruncated: false,
  resultType: "tabular" as const,
  rowCount: count,
  rows: Array.from({ length: count }, () => [1]),
});

type Execute = (
  sql: string,
  maxRows: number,
  schema: string | null,
  signal: AbortSignal,
  options?: ExecuteOptions
) => Promise<ReturnType<typeof rowsResult>>;

const countsFor =
  (counts: Record<string, number>): Execute =>
  (sql) => {
    const table = /FROM "public"\."(\w+)"/.exec(sql)?.[1] ?? "";
    return Promise.resolve(rowsResult(counts[table] ?? 0));
  };

const hang: Execute = () => Promise.withResolvers<never>().promise;

const hangOn =
  (table: string, otherwise: Execute): Execute =>
  (sql, ...rest) =>
    sql.includes(`"${table}"`) ? hang(sql, ...rest) : otherwise(sql, ...rest);

const failing = vi
  .fn<Execute>()
  .mockRejectedValue(
    new Error(`invalid input syntax for type uuid: "${UUID}"`)
  );

const sleep = async (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  await promise;
};

const FAST: LookupTiming = {
  budgetMs: 2000,
  concurrency: 3,
  probeTimeoutMs: 40,
};

const setup = ({
  execute = countsFor({ orders: 12, users: 1 }),
  dialect = "postgresql",
  timing = FAST,
  schema = SCHEMA,
}: {
  execute?: Execute;
  dialect?: string | null;
  timing?: LookupTiming;
  schema?: SchemaInfo;
} = {}) => {
  const pool = {
    dialect,
    execute: vi.fn(execute),
    listDatabases: vi.fn().mockResolvedValue(["public"]),
  };
  const pools = {
    connect: vi.fn<ConnectionPoolManager["connect"]>().mockResolvedValue(),
    getPool: vi.fn(() => pool),
    has: vi.fn(() => true),
  };
  const schemas: SchemaCache = {
    get: vi.fn().mockResolvedValue(schema),
    invalidate: vi.fn(),
  };
  const messages: LookupEventMessage[] = [];
  const service = createLookupService({
    pools: pools as unknown as ConnectionPoolManager,
    schemas,
    send: (message) => messages.push(message),
    timing,
  });
  const eventsFor = (lookupId: string): LookupEvent[] =>
    messages
      .filter((message) => message.lookupId === lookupId)
      .map((message) => message.event);
  const settled = (lookupId: string) =>
    vi.waitFor(() => {
      const last = eventsFor(lookupId).at(-1);
      expect(["done", "error"]).toContain(last?.type);
    });
  return { eventsFor, pool, service, settled };
};

const UUID_VALUE = { kind: "uuid", value: UUID };

const lookup = (
  lookupId: string,
  value: { kind: string; value: string } = UUID_VALUE,
  connectionId = "pg"
) => ({ connectionId, database: null, lookupId, value });

vi.mocked(getConnections).mockResolvedValue([
  connection("pg"),
  connection("ch", "clickhouse"),
  connection("mongo", "mongodb"),
]);

describe("createLookupService", () => {
  it("plans, reports hits by rank, and finishes", async () => {
    const { eventsFor, service, settled } = setup();
    service.startLookup(lookup("l1"));
    await settled("l1");

    const events = eventsFor("l1");
    expect(events[0]).toStrictEqual({
      probes: 3,
      skipped: { largeUnindexed: 0, outOfRange: 0, overLimit: 0 },
      tables: 3,
      type: "planned",
    });
    expect(
      events.filter((event) => event.type === "hit").map((event) => event.hit)
    ).toMatchObject([
      { capped: false, column: "id", matchedRows: 1, rank: 0, table: "users" },
      { column: "user_id", matchedRows: 12, rank: 2, table: "orders" },
    ]);
    expect(events.filter((event) => event.type === "progress")).toHaveLength(3);
    expect(events.at(-1)).toMatchObject({
      budgetExceeded: false,
      type: "done",
    });
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it("binds the value, bounds every probe, and runs it read-only", async () => {
    const { pool, service, settled } = setup();
    service.startLookup(lookup("l1"));
    await settled("l1");

    const calls = pool.execute.mock.calls.map(
      ([sql, maxRows, schema, , options]) => ({
        inlined: sql.includes(UUID),
        maxRows,
        options,
        schema,
        shape: sql.endsWith("= $1 LIMIT 101"),
      })
    );
    expect(calls).toStrictEqual(
      Array.from({ length: 3 }, () => ({
        inlined: false,
        maxRows: 101,
        options: { params: [UUID], readOnly: true },
        schema: "public",
        shape: true,
      }))
    );
  });

  it("caps the reported count at 100", async () => {
    const { eventsFor, service, settled } = setup({
      execute: countsFor({ users: 101 }),
    });
    service.startLookup(lookup("l1"));
    await settled("l1");
    expect(eventsFor("l1")).toContainEqual(
      expect.objectContaining({
        hit: expect.objectContaining({ capped: true, matchedRows: 100 }),
      })
    );
  });

  it("never runs more than three probes at once", async () => {
    const wide: SchemaInfo = {
      schemas: [
        {
          name: "public",
          tables: Array.from({ length: 8 }, (_, index) =>
            uuidTable(`t${index}`)
          ),
          views: [],
        },
      ],
    };
    let running = 0;
    let peak = 0;
    const execute: Execute = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(5);
      running -= 1;
      return rowsResult(0);
    };
    const { eventsFor, service, settled } = setup({ execute, schema: wide });
    service.startLookup(lookup("l1"));
    await settled("l1");
    expect(peak).toBe(3);
    expect(eventsFor("l1").at(-1)).toMatchObject({ type: "done" });
  });

  it("reports a hanging probe as a timeout and finishes the others", async () => {
    const { eventsFor, service, settled } = setup({
      execute: hangOn("users", countsFor({ orders: 2 })),
    });
    service.startLookup(lookup("l1"));
    await settled("l1");

    const events = eventsFor("l1");
    expect(events).toContainEqual({
      column: "id",
      reason: "timeout",
      table: "users",
      type: "probeFailed",
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        hit: expect.objectContaining({ table: "orders" }),
      })
    );
    expect(events.at(-1)).toMatchObject({
      budgetExceeded: false,
      type: "done",
    });
  });

  it("reports a failing probe without logging the value", async () => {
    const error = vi.spyOn(console, "error").mockReturnValue();
    const { eventsFor, service, settled } = setup({ execute: failing });
    service.startLookup(lookup("l1"));
    await settled("l1");

    expect(eventsFor("l1")).toContainEqual(
      expect.objectContaining({ reason: "error", type: "probeFailed" })
    );
    const logged = error.mock.calls.flat().join(" ");
    expect(logged).not.toContain(UUID);
    expect(logged).toContain("[value]");
    error.mockRestore();
  });

  it("ends a slow lookup at the total budget", async () => {
    const { eventsFor, pool, service, settled } = setup({
      execute: hang,
      timing: { budgetMs: 60, concurrency: 1, probeTimeoutMs: 1000 },
    });
    service.startLookup(lookup("l1"));
    await settled("l1");

    expect(eventsFor("l1").at(-1)).toMatchObject({
      budgetExceeded: true,
      type: "done",
    });
    expect(pool.execute).toHaveBeenCalledOnce();
  });

  it("cancels the previous lookup on the same connection", async () => {
    const { eventsFor, service, settled } = setup({
      execute: hang,
      timing: { ...FAST, probeTimeoutMs: 1000 },
    });
    service.startLookup(lookup("first"));
    await vi.waitFor(() => {
      expect(eventsFor("first")[0]?.type).toBe("planned");
    });
    service.startLookup(lookup("second"));
    await settled("first");
    expect(eventsFor("first").at(-1)).toMatchObject({
      code: "CANCELLED",
      type: "error",
    });
    service.cancelLookup("second");
    await settled("second");
  });

  it("stops scheduling probes on cancelLookup", async () => {
    const { eventsFor, pool, service, settled } = setup({
      execute: hang,
      timing: { budgetMs: 2000, concurrency: 1, probeTimeoutMs: 1000 },
    });
    service.startLookup(lookup("l1"));
    await vi.waitFor(() => {
      expect(pool.execute).toHaveBeenCalledOnce();
    });
    service.cancelLookup("l1");
    await settled("l1");

    expect(eventsFor("l1").at(-1)).toMatchObject({ code: "CANCELLED" });
    expect(pool.execute).toHaveBeenCalledOnce();
  });

  it.each([
    ["ch", "clickhouse", "ID lookup isn't available for ClickHouse yet."],
    ["mongo", null, "ID lookup works with SQL databases."],
  ])("refuses %s connections", async (connectionId, dialect, message) => {
    const { eventsFor, pool, service, settled } = setup({ dialect });
    service.startLookup(lookup("l1", undefined, connectionId));
    await settled("l1");
    expect(eventsFor("l1")).toStrictEqual([
      { code: "UNSUPPORTED_ENGINE", message, type: "error" },
    ]);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("explains when no column could hold the value", async () => {
    const { eventsFor, service, settled } = setup();
    service.startLookup(
      lookup("l1", { kind: "email", value: "ada@example.com" })
    );
    await settled("l1");
    expect(eventsFor("l1")).toStrictEqual([
      {
        code: "NO_CANDIDATES",
        message: "No columns in public look like they hold an email.",
        type: "error",
      },
    ]);
  });

  it("stops with FAILED when a probe doesn't pass the read-only guard", async () => {
    const odd: SchemaInfo = {
      schemas: [{ name: "public", tables: [uuidTable("weird\\")], views: [] }],
    };
    const { eventsFor, pool, service, settled } = setup({ schema: odd });
    service.startLookup(lookup("l1"));
    await settled("l1");
    expect(eventsFor("l1").map((event) => event.type)).toStrictEqual([
      "planned",
      "error",
    ]);
    expect(eventsFor("l1").at(-1)).toMatchObject({ code: "FAILED" });
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("reports a connection that no longer exists", async () => {
    const { eventsFor, service, settled } = setup();
    service.startLookup(lookup("l1", undefined, "gone"));
    await settled("l1");
    expect(eventsFor("l1")).toMatchObject([{ code: "CONNECTION_MISSING" }]);
  });

  it.each([
    ["a value that doesn't match its kind", { kind: "uuid", value: "42" }],
    ["SQL posing as an email", { kind: "email", value: "' or 1=1 --" }],
  ])("rejects %s at the boundary", (_label, value) => {
    const { service } = setup();
    expect(() => service.startLookup(lookup("l1", value))).toThrow(
      "That value isn't an id or email."
    );
  });
});
