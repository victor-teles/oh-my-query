import type { DatabaseConnection } from "@oh-my-query/core";
import type { ConnectionPoolManager } from "@oh-my-query/drivers";

import { getConnections } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { createSchemaCache } from "./schema-cache.ts";
import { createSchemaPeek } from "./schema-peek.ts";

vi.mock(import("@oh-my-query/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  getConnections: vi.fn(),
}));

const connection: DatabaseConnection = {
  createdAt: "2026-11-18T00:00:00.000Z",
  database: "oh_my_query",
  host: "127.0.0.1",
  id: "conn-1",
  lastConnectedAt: null,
  name: "analytics",
  password: "secret",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "omq",
};

const SCHEMA = { schemas: [{ name: "public", tables: [], views: [] }] };

const setup = ({
  dialect = "postgresql",
  connected = true,
}: { dialect?: string | null; connected?: boolean } = {}) => {
  const fetchSchema = vi.fn().mockResolvedValue(SCHEMA);
  const pool = {
    dialect,
    fetchSchema,
    listDatabases: vi.fn().mockResolvedValue(["public"]),
  };
  const live = { value: connected };
  const pools = {
    connect: vi.fn(() => {
      live.value = true;
      return Promise.resolve();
    }),
    getPool: vi.fn(() => pool),
    has: vi.fn(() => live.value),
  } as unknown as ConnectionPoolManager;
  const peek = createSchemaPeek({ pools, schemas: createSchemaCache(pools) });
  return { fetchSchema, peek, pools };
};

vi.mocked(getConnections).mockResolvedValue([connection]);

describe("createSchemaPeek", () => {
  it("returns the resolved schema with its dialect", async () => {
    const { peek } = setup();
    await expect(peek.peek({ connectionId: "conn-1" })).resolves.toStrictEqual({
      database: "public",
      dialect: "postgresql",
      schema: SCHEMA,
    });
  });

  it("connects a pool that is not live yet", async () => {
    const { peek, pools } = setup({ connected: false });
    await peek.peek({ connectionId: "conn-1" });
    expect(pools.connect).toHaveBeenCalledOnce();
  });

  it("serves a second peek from the schema cache", async () => {
    const { fetchSchema, peek } = setup();
    await peek.peek({ connectionId: "conn-1" });
    await peek.peek({ connectionId: "conn-1" });
    expect(fetchSchema).toHaveBeenCalledOnce();
  });

  it("reports a missing connection", async () => {
    const { peek } = setup();
    await expect(peek.peek({ connectionId: "gone" })).rejects.toMatchObject({
      code: "CONNECTION_MISSING",
    });
  });

  it("refuses engines without a SQL dialect", async () => {
    const { peek } = setup({ dialect: null });
    await expect(peek.peek({ connectionId: "conn-1" })).rejects.toMatchObject({
      code: "UNSUPPORTED_ENGINE",
      message: "Table peek works with SQL databases for now.",
    });
  });

  it("validates its input", async () => {
    const { peek } = setup();
    await expect(peek.peek({ connectionId: "" })).rejects.toThrow("Too small");
  });
});
