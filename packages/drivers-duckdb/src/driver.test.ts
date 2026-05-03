import type * as DuckdbApi from "@duckdb/node-api";
import type { ConnectionParams } from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock<typeof DuckdbApi>(
  import("@duckdb/node-api"),
  () =>
    ({
      DuckDBInstance: { create: createMock },
    }) as unknown as typeof DuckdbApi
);

const { DuckdbDriver, resolvePath } = await import("./driver.ts");
const { DuckdbPool } = await import("./pool.ts");

const params = (overrides: Partial<ConnectionParams> = {}): ConnectionParams =>
  ({
    database: "/tmp/db.duckdb",
    ...overrides,
  }) as ConnectionParams;

const noop = async () => {
  await Promise.resolve();
};

const buildFakeConnection = (
  runImpl: (sql: string) => Promise<unknown> = noop
) => {
  const run = vi.fn(runImpl);
  const disconnect = vi.fn();
  return { conn: { disconnect, run }, disconnect, run };
};

const buildFakeInstance = (conn: {
  disconnect: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}) => {
  const connect = vi.fn().mockResolvedValue(conn);
  return { connect };
};

const rejecting = (message: string) => async () => {
  await Promise.resolve();
  throw new Error(message);
};

describe("resolvePath", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  afterEach(() => {
    createMock.mockReset();
  });

  it("returns the database path when set", () => {
    expect(resolvePath(params({ database: "/data/foo.db" }))).toBe(
      "/data/foo.db"
    );
  });

  it("falls back to :memory: when database is empty", () => {
    expect(resolvePath(params({ database: "" }))).toBe(":memory:");
  });

  it("falls back to :memory: when database is whitespace-only", () => {
    expect(resolvePath(params({ database: "   " }))).toBe(":memory:");
  });

  it("falls back to :memory: when database is undefined", () => {
    expect(resolvePath(params({ database: undefined }))).toBe(":memory:");
  });
});

describe("duckdbDriver", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("identifies as duckdb", () => {
    expect(new DuckdbDriver().dbType).toBe("duckdb");
  });
});

describe("duckdbDriver.testConnection", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("opens an instance using the resolved path and the dbType as user agent", async () => {
    const fake = buildFakeConnection();
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    await new DuckdbDriver().testConnection(params({ database: "/tmp/x.db" }));

    expect(createMock).toHaveBeenCalledWith("/tmp/x.db", {
      custom_user_agent: "duckdb",
    });
  });

  it("returns success with a non-negative latency on a healthy probe", async () => {
    const fake = buildFakeConnection();
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    const result = await new DuckdbDriver().testConnection(params());
    expect(result.success).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toContain("duckdb");
    expect(fake.run).toHaveBeenCalledWith("SELECT 1");
  });

  it("disconnects after a successful probe", async () => {
    const fake = buildFakeConnection();
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    await new DuckdbDriver().testConnection(params());
    expect(fake.disconnect).toHaveBeenCalledWith();
  });

  it("wraps native errors in DbError and still disconnects", async () => {
    const fake = buildFakeConnection(rejecting("boom"));
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    let caught: unknown;
    try {
      await new DuckdbDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("boom");
    expect(fake.disconnect).toHaveBeenCalledWith();
  });

  it("wraps instance-open failures in DbError", async () => {
    createMock.mockRejectedValue(new Error("cannot open file"));
    let caught: unknown;
    try {
      await new DuckdbDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("cannot open file");
  });
});

describe("duckdbDriver.connect", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns a DuckdbPool after a healthy probe and releases the probe connection", async () => {
    const fake = buildFakeConnection();
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    const pool = await new DuckdbDriver().connect("conn-1", params());
    expect(pool).toBeInstanceOf(DuckdbPool);
    expect(fake.run).toHaveBeenCalledWith("SELECT 1");
    expect(fake.disconnect).toHaveBeenCalledWith();
  });

  it("rejects with DbError and disconnects when the probe fails", async () => {
    const fake = buildFakeConnection(rejecting("auth failed"));
    const instance = buildFakeInstance(fake.conn);
    createMock.mockResolvedValue(instance);

    let caught: unknown;
    try {
      await new DuckdbDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("auth failed");
    expect(fake.disconnect).toHaveBeenCalledWith();
  });

  it("propagates instance-open failures as DbError without calling connect", async () => {
    createMock.mockRejectedValue(new Error("disk full"));
    let caught: unknown;
    try {
      await new DuckdbDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("disk full");
  });
});
