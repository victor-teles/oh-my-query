import type { TableItem } from "@oh-my-query/core";
import type { MongoClient } from "mongodb";

import { DbError } from "@oh-my-query/core";
import { describe, expect, it, vi } from "vitest";

import { isMongoPool, mapMongoError, MongoPool } from "./pool.ts";

interface FakeCollection {
  indexes: ReturnType<typeof vi.fn>;
  estimatedDocumentCount: ReturnType<typeof vi.fn>;
}

interface FakeClient {
  close: ReturnType<typeof vi.fn>;
  db: ReturnType<typeof vi.fn>;
  serverInfo: ReturnType<typeof vi.fn>;
  listDatabases: ReturnType<typeof vi.fn>;
  listCollectionsToArray: ReturnType<typeof vi.fn>;
  getCollection: (name: string) => FakeCollection;
}

const buildFakeClient = (): FakeClient => {
  const serverInfo = vi.fn();
  const listDatabases = vi.fn();
  const listCollectionsToArray = vi.fn();
  const close = vi.fn(async () => {
    await Promise.resolve();
  });
  const collections = new Map<string, FakeCollection>();

  const getCollection = (name: string): FakeCollection => {
    const existing = collections.get(name);
    if (existing) {
      return existing;
    }
    const created: FakeCollection = {
      estimatedDocumentCount: vi.fn(),
      indexes: vi.fn(),
    };
    collections.set(name, created);
    return created;
  };

  const admin = () => ({ listDatabases, serverInfo });
  const listCollections = () => ({ toArray: listCollectionsToArray });

  const db = vi.fn(() => ({
    admin,
    collection: getCollection,
    listCollections,
  }));

  return {
    close,
    db,
    getCollection,
    listCollectionsToArray,
    listDatabases,
    serverInfo,
  };
};

const buildPool = (
  defaultDb = "test"
): { client: FakeClient; pool: MongoPool } => {
  const client = buildFakeClient();
  const pool = new MongoPool(
    { close: client.close, db: client.db } as unknown as MongoClient,
    defaultDb
  );
  return { client, pool };
};

describe("isMongoPool", () => {
  it("returns true for a MongoPool instance", () => {
    const { pool } = buildPool();
    expect(isMongoPool(pool)).toBeTruthy();
  });

  it("returns false for a plain object", () => {
    expect(isMongoPool({} as unknown as MongoPool)).toBeFalsy();
  });
});

describe("mongoPool > fetchVersion", () => {
  it("returns 'Mongo X.Y.Z' from serverInfo", async () => {
    const { client, pool } = buildPool();
    client.serverInfo.mockResolvedValue({ version: "7.0.5" });
    await expect(pool.fetchVersion()).resolves.toBe("Mongo 7.0.5");
    expect(client.db).toHaveBeenCalledWith("test");
  });

  it("returns empty string when version is missing", async () => {
    const { client, pool } = buildPool();
    client.serverInfo.mockResolvedValue({});
    await expect(pool.fetchVersion()).resolves.toBe("");
  });

  it("wraps native errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.serverInfo.mockRejectedValue(new Error("not authorized"));
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("not authorized");
  });
});

describe("mongoPool > listDatabases", () => {
  it("returns all database names from listDatabases", async () => {
    const { client, pool } = buildPool();
    client.listDatabases.mockResolvedValue({
      databases: [{ name: "admin" }, { name: "config" }, { name: "myapp" }],
    });
    await expect(pool.listDatabases()).resolves.toStrictEqual([
      "admin",
      "config",
      "myapp",
    ]);
    expect(client.listDatabases).toHaveBeenCalledWith({ nameOnly: true });
  });

  it("falls back to [defaultDb] when listDatabases rejects", async () => {
    const { client, pool } = buildPool("myapp");
    client.listDatabases.mockRejectedValue(new Error("not authorized"));
    await expect(pool.listDatabases()).resolves.toStrictEqual(["myapp"]);
  });

  it("falls back to [defaultDb] when result has no databases", async () => {
    const { client, pool } = buildPool("myapp");
    client.listDatabases.mockResolvedValue({ databases: [] });
    await expect(pool.listDatabases()).resolves.toStrictEqual(["myapp"]);
  });
});

describe("mongoPool > fetchSchema", () => {
  it("returns collections as tables with indexes and rowEstimate", async () => {
    const { client, pool } = buildPool();
    client.listCollectionsToArray.mockResolvedValue([
      { name: "users", type: "collection" },
      { name: "orders", type: "collection" },
    ]);
    const users = client.getCollection("users");
    const orders = client.getCollection("orders");
    users.indexes.mockResolvedValue([
      { key: { _id: 1 }, name: "_id_" },
      { key: { email: 1 }, name: "email_unique", unique: true },
    ]);
    users.estimatedDocumentCount.mockResolvedValue(42);
    orders.indexes.mockResolvedValue([{ key: { _id: 1 }, name: "_id_" }]);
    orders.estimatedDocumentCount.mockResolvedValue(7);

    const result = await pool.fetchSchema("myapp");
    expect(result.schemas).toHaveLength(1);
    const [schema] = result.schemas;
    expect(schema?.name).toBe("myapp");
    expect(schema?.views).toStrictEqual([]);
    expect(schema?.tables).toStrictEqual([
      {
        columns: [],
        foreignKeys: [],
        indexes: [{ columns: ["_id"], isUnique: false, name: "_id_" }],
        name: "orders",
        rowEstimate: 7,
      },
      {
        columns: [],
        foreignKeys: [],
        indexes: [
          { columns: ["_id"], isUnique: false, name: "_id_" },
          { columns: ["email"], isUnique: true, name: "email_unique" },
        ],
        name: "users",
        rowEstimate: 42,
      },
    ]);
  });

  it("separates views from tables", async () => {
    const { client, pool } = buildPool();
    client.listCollectionsToArray.mockResolvedValue([
      { name: "users", type: "collection" },
      { name: "active_users", type: "view" },
    ]);
    const users = client.getCollection("users");
    users.indexes.mockResolvedValue([]);
    users.estimatedDocumentCount.mockResolvedValue(0);

    const result = await pool.fetchSchema("myapp");
    const [schema] = result.schemas;
    expect(schema?.tables.map((t) => t.name)).toStrictEqual(["users"]);
    expect(schema?.views).toStrictEqual([
      { columns: [], name: "active_users" },
    ]);
  });

  it("filters out system collections", async () => {
    const { client, pool } = buildPool();
    client.listCollectionsToArray.mockResolvedValue([
      { name: "system.views", type: "collection" },
      { name: "users", type: "collection" },
    ]);
    const users = client.getCollection("users");
    users.indexes.mockResolvedValue([]);
    users.estimatedDocumentCount.mockResolvedValue(1);

    const result = await pool.fetchSchema("myapp");
    const [schema] = result.schemas;
    expect(schema?.tables.map((t) => t.name)).toStrictEqual(["users"]);
  });

  it("uses null rowEstimate when estimatedDocumentCount rejects", async () => {
    const { client, pool } = buildPool();
    client.listCollectionsToArray.mockResolvedValue([
      { name: "events", type: "collection" },
    ]);
    const events = client.getCollection("events");
    events.indexes.mockResolvedValue([]);
    events.estimatedDocumentCount.mockRejectedValue(
      new Error("permission denied")
    );

    const result = await pool.fetchSchema("myapp");
    const [{ tables }] = result.schemas as unknown as [{ tables: TableItem[] }];
    const [table] = tables;
    expect(table?.rowEstimate).toBeNull();
  });

  it("wraps listCollections errors in DbError", async () => {
    const { client, pool } = buildPool();
    client.listCollectionsToArray.mockRejectedValue(
      new Error("not authorized")
    );
    const err = await pool
      .fetchSchema("myapp")
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("not authorized");
  });
});

describe("mongoPool > execute / explain", () => {
  it("execute rejects with UNSUPPORTED", async () => {
    const { pool } = buildPool();
    const err = await pool
      .execute("SELECT 1", 100, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED");
  });

  it("explain rejects with UNSUPPORTED", async () => {
    const { pool } = buildPool();
    const err = await pool
      .explain("SELECT 1", false, null, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("UNSUPPORTED");
  });
});

describe("mongoPool > close", () => {
  it("calls close on the client", async () => {
    const { client, pool } = buildPool();
    await pool.close();
    expect(client.close).toHaveBeenCalledWith();
  });

  it("makes subsequent operations fail with POOL_CLOSED", async () => {
    const { pool } = buildPool();
    await pool.close();
    const err = await pool.fetchVersion().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe("POOL_CLOSED");
  });

  it("is idempotent — second close is a no-op", async () => {
    const { client, pool } = buildPool();
    await pool.close();
    await expect(pool.close()).resolves.toBeUndefined();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("swallows close errors", async () => {
    const { client, pool } = buildPool();
    client.close.mockRejectedValueOnce(new Error("already closing"));
    await expect(pool.close()).resolves.toBeUndefined();
  });
});

describe("mapMongoError", () => {
  it("returns DbError instances unchanged", () => {
    const original = new DbError("FOO", "bar");
    expect(mapMongoError(original)).toBe(original);
  });

  it("wraps a generic Error into DbError with DB_ERROR code", () => {
    const wrapped = mapMongoError(new Error("boom"));
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.code).toBe("DB_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("prefers codeName when present (e.g. AuthenticationFailed)", () => {
    const err = Object.assign(new Error("auth failed"), {
      code: 18,
      codeName: "AuthenticationFailed",
    });
    const wrapped = mapMongoError(err);
    expect(wrapped.code).toBe("AuthenticationFailed");
    expect(wrapped.message).toBe("auth failed");
  });

  it("falls back to numeric code stringified when codeName is missing", () => {
    const err = Object.assign(new Error("duplicate key"), { code: 11_000 });
    const wrapped = mapMongoError(err);
    expect(wrapped.code).toBe("11000");
  });

  it("falls back to error name when message is empty", () => {
    const wrapped = mapMongoError({ message: "", name: "MongoNetworkError" });
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("MongoNetworkError");
  });

  it("stringifies non-Error values", () => {
    const wrapped = mapMongoError(42);
    expect(wrapped).toBeInstanceOf(DbError);
    expect(wrapped.message).toBe("42");
  });
});
