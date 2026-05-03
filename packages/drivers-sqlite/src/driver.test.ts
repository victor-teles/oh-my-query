import type { ConnectionParams } from "@oh-my-query/core";
import type * as BunSqlite from "bun:sqlite";

import { DbError } from "@oh-my-query/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DatabaseMock = vi.hoisted(() => vi.fn());

vi.mock<typeof BunSqlite>(
  import("bun:sqlite"),
  () =>
    ({
      Database: DatabaseMock,
    }) as unknown as typeof BunSqlite
);

const { SqliteDriver, resolvePath } = await import("./driver.ts");
const { SqlitePool } = await import("./pool.ts");

const params = (overrides: Partial<ConnectionParams> = {}): ConnectionParams =>
  ({
    database: "/tmp/db.sqlite",
    host: "",
    password: "",
    port: 0,
    type: "sqlite",
    username: "",
    ...overrides,
  }) as ConnectionParams;

interface FakeStatement {
  get: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
}

interface FakeDb {
  query: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const buildFakeDb = (
  getImpl: () => unknown = () => ({ ok: 1 })
): { db: FakeDb; stmt: FakeStatement } => {
  const stmt: FakeStatement = {
    finalize: vi.fn(),
    get: vi.fn(getImpl),
  };
  const db: FakeDb = {
    close: vi.fn(),
    query: vi.fn(() => stmt),
  };
  return { db, stmt };
};

const stubReturn = (value: unknown) =>
  function stubReturn() {
    return value;
  };

const stubThrow = (err: unknown) =>
  function stubThrow() {
    throw err;
  };

describe("resolvePath", () => {
  it("returns the database path when set", () => {
    expect(resolvePath(params({ database: "/data/foo.sqlite" }))).toBe(
      "/data/foo.sqlite"
    );
  });

  it("falls back to :memory: when database is empty", () => {
    expect(resolvePath(params({ database: "" }))).toBe(":memory:");
  });

  it("falls back to :memory: when database is whitespace-only", () => {
    expect(resolvePath(params({ database: "   " }))).toBe(":memory:");
  });

  it("falls back to :memory: when database is undefined", () => {
    expect(
      resolvePath(params({ database: undefined as unknown as string }))
    ).toBe(":memory:");
  });
});

describe("sqliteDriver", () => {
  beforeEach(() => {
    DatabaseMock.mockReset();
  });

  afterEach(() => {
    DatabaseMock.mockReset();
  });

  it("identifies as sqlite", () => {
    expect(new SqliteDriver().dbType).toBe("sqlite");
  });
});

describe("sqliteDriver.testConnection", () => {
  beforeEach(() => {
    DatabaseMock.mockReset();
  });

  it("opens a Database with the resolved file path", async () => {
    const { db } = buildFakeDb();
    DatabaseMock.mockImplementation(stubReturn(db));

    await new SqliteDriver().testConnection(params({ database: "/tmp/x.db" }));

    expect(DatabaseMock).toHaveBeenCalledWith(
      "/tmp/x.db",
      expect.objectContaining({ create: true, readwrite: true })
    );
  });

  it("opens :memory: when path is empty", async () => {
    const { db } = buildFakeDb();
    DatabaseMock.mockImplementation(stubReturn(db));

    await new SqliteDriver().testConnection(params({ database: "" }));

    expect(DatabaseMock).toHaveBeenCalledWith(
      ":memory:",
      expect.objectContaining({ create: true, readwrite: true })
    );
  });

  it("returns success with non-negative latency on a healthy probe", async () => {
    const { db, stmt } = buildFakeDb();
    DatabaseMock.mockImplementation(stubReturn(db));

    const result = await new SqliteDriver().testConnection(params());
    expect(result.success).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message.toLowerCase()).toContain("sqlite");
    expect(db.query).toHaveBeenCalledWith("SELECT 1");
    expect(stmt.get).toHaveBeenCalledOnce();
  });

  it("closes the database after a successful probe", async () => {
    const { db } = buildFakeDb();
    DatabaseMock.mockImplementation(stubReturn(db));

    await new SqliteDriver().testConnection(params());
    expect(db.close).toHaveBeenCalledWith();
  });

  it("wraps probe errors in DbError and still closes the db", async () => {
    const { db } = buildFakeDb(() => {
      throw new Error("file is not a database");
    });
    DatabaseMock.mockImplementation(stubReturn(db));

    let caught: unknown;
    try {
      await new SqliteDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("file is not a database");
    expect(db.close).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError", async () => {
    DatabaseMock.mockImplementation(stubThrow(new Error("permission denied")));
    let caught: unknown;
    try {
      await new SqliteDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("permission denied");
  });
});

describe("sqliteDriver.connect", () => {
  beforeEach(() => {
    DatabaseMock.mockReset();
  });

  it("returns a SqlitePool after a healthy probe", async () => {
    const { db } = buildFakeDb();
    DatabaseMock.mockImplementation(stubReturn(db));

    const pool = await new SqliteDriver().connect("conn-1", params());
    expect(pool).toBeInstanceOf(SqlitePool);
    expect(db.query).toHaveBeenCalledWith("SELECT 1");
    expect(db.close).not.toHaveBeenCalled();
  });

  it("rejects with DbError and closes the db when the probe fails", async () => {
    const { db } = buildFakeDb(() => {
      throw new Error("malformed db");
    });
    DatabaseMock.mockImplementation(stubReturn(db));

    let caught: unknown;
    try {
      await new SqliteDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("malformed db");
    expect(db.close).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError without calling query", async () => {
    DatabaseMock.mockImplementation(stubThrow(new Error("disk full")));
    let caught: unknown;
    try {
      await new SqliteDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("disk full");
  });
});
