import type { ConnectionParams } from "@oh-my-query/core";
import type * as Mssql from "mssql";

import { DbError } from "@oh-my-query/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ConnectionPoolMock = vi.hoisted(() => vi.fn());

vi.mock<typeof Mssql>(
  import("mssql"),
  () =>
    ({
      ConnectionPool: ConnectionPoolMock,
      default: { ConnectionPool: ConnectionPoolMock },
    }) as unknown as typeof Mssql
);

const { MssqlDriver } = await import("./driver.ts");
const { MssqlPool } = await import("./pool.ts");

const params = (overrides: Partial<ConnectionParams> = {}): ConnectionParams =>
  ({
    database: "appdb",
    host: "sql.example.com",
    password: "secret",
    port: 1433,
    type: "mssql",
    username: "sa",
    ...overrides,
  }) as ConnectionParams;

interface FakePool {
  connect: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
}

const buildFakePool = (
  queryImpl: () => Promise<unknown> = async () => {
    await Promise.resolve();
    return {
      recordset: [{ "1": 1 }],
      recordsets: [[{ "1": 1 }]],
      rowsAffected: [1],
    };
  }
): FakePool => {
  const pool: FakePool = {
    close: vi.fn(async () => {
      await Promise.resolve();
    }),
    connect: vi.fn(async () => {
      await Promise.resolve();
      return pool;
    }),
    query: vi.fn(queryImpl),
    request: vi.fn(),
  };
  return pool;
};

const stubReturn = (value: unknown) =>
  function stubReturn() {
    return value;
  };

const stubThrow = (err: unknown) =>
  function stubThrow() {
    throw err;
  };

describe("mssqlDriver", () => {
  beforeEach(() => {
    ConnectionPoolMock.mockReset();
  });

  afterEach(() => {
    ConnectionPoolMock.mockReset();
  });

  it("identifies as mssql", () => {
    expect(new MssqlDriver().dbType).toBe("mssql");
  });
});

describe("mssqlDriver.testConnection", () => {
  beforeEach(() => {
    ConnectionPoolMock.mockReset();
  });

  it("constructs a ConnectionPool with server, port, db, and credentials", async () => {
    const fake = buildFakePool();
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    await new MssqlDriver().testConnection(params());

    expect(ConnectionPoolMock).toHaveBeenCalledOnce();
    const cfg = ConnectionPoolMock.mock.calls[0]?.[0];
    expect(cfg).toMatchObject({
      database: "appdb",
      password: "secret",
      port: 1433,
      server: "sql.example.com",
      user: "sa",
    });
  });

  it("returns success with non-negative latency on a healthy probe", async () => {
    const fake = buildFakePool();
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    const result = await new MssqlDriver().testConnection(params());
    expect(result.success).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message.toLowerCase()).toContain("mssql");
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("closes the pool after a successful probe", async () => {
    const fake = buildFakePool();
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    await new MssqlDriver().testConnection(params());
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps probe errors in DbError and still closes the pool", async () => {
    const fake = buildFakePool(async () => {
      await Promise.resolve();
      throw new Error("Login failed");
    });
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new MssqlDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("Login failed");
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps connect failures in DbError", async () => {
    const fake = buildFakePool();
    fake.connect.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new MssqlDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("ECONNREFUSED");
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError", async () => {
    ConnectionPoolMock.mockImplementation(
      stubThrow(new Error("invalid options"))
    );
    let caught: unknown;
    try {
      await new MssqlDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("invalid options");
  });
});

describe("mssqlDriver.connect", () => {
  beforeEach(() => {
    ConnectionPoolMock.mockReset();
  });

  it("returns an MssqlPool after a healthy probe", async () => {
    const fake = buildFakePool();
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    const pool = await new MssqlDriver().connect("conn-1", params());
    expect(pool).toBeInstanceOf(MssqlPool);
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.query).toHaveBeenCalledWith("SELECT 1");
    expect(fake.close).not.toHaveBeenCalled();
  });

  it("rejects with DbError and closes the pool when the probe fails", async () => {
    const fake = buildFakePool(async () => {
      await Promise.resolve();
      throw new Error("Login timeout expired");
    });
    ConnectionPoolMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new MssqlDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("Login timeout expired");
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError without calling connect", async () => {
    ConnectionPoolMock.mockImplementation(stubThrow(new Error("dns failure")));
    let caught: unknown;
    try {
      await new MssqlDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("dns failure");
  });
});
