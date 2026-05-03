import type { ConnectionParams } from "@oh-my-query/core";
import type * as IORedis from "ioredis";

import { DbError } from "@oh-my-query/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RedisMock = vi.hoisted(() => vi.fn());

vi.mock<typeof IORedis>(
  import("ioredis"),
  () =>
    ({
      Redis: RedisMock,
      default: RedisMock,
    }) as unknown as typeof IORedis
);

const { RedisDriver, parseDbIndex } = await import("./driver.ts");
const { RedisPool } = await import("./pool.ts");

const params = (overrides: Partial<ConnectionParams> = {}): ConnectionParams =>
  ({
    database: "0",
    host: "localhost",
    password: "",
    port: 6379,
    type: "redis",
    username: "",
    ...overrides,
  }) as ConnectionParams;

interface FakeClient {
  ping: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const defaultPing = async () => {
  await Promise.resolve();
  return "PONG";
};

const buildFakeClient = (
  pingImpl: () => Promise<unknown> = defaultPing
): FakeClient => ({
  disconnect: vi.fn(),
  ping: vi.fn(pingImpl),
  quit: vi.fn(async () => {
    await Promise.resolve();
    return "OK";
  }),
});

const stubReturn = (value: unknown) =>
  function stubReturn() {
    return value;
  };

const stubThrow = (err: unknown) =>
  function stubThrow() {
    throw err;
  };

describe("parseDbIndex", () => {
  it("parses a numeric string", () => {
    expect(parseDbIndex("3")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(parseDbIndex("")).toBe(0);
  });

  it("returns 0 for whitespace", () => {
    expect(parseDbIndex("   ")).toBe(0);
  });

  it("returns 0 for non-numeric input", () => {
    expect(parseDbIndex("nope")).toBe(0);
  });

  it("returns 0 for negative values", () => {
    expect(parseDbIndex("-1")).toBe(0);
  });
});

describe("redisDriver", () => {
  beforeEach(() => {
    RedisMock.mockReset();
  });

  afterEach(() => {
    RedisMock.mockReset();
  });

  it("identifies as redis", () => {
    expect(new RedisDriver().dbType).toBe("redis");
  });
});

describe("redisDriver.testConnection", () => {
  beforeEach(() => {
    RedisMock.mockReset();
  });

  it("constructs a Redis client with host, port, db, and credentials", async () => {
    const fake = buildFakeClient();
    RedisMock.mockImplementation(stubReturn(fake));

    await new RedisDriver().testConnection(
      params({
        database: "5",
        host: "redis.example.com",
        password: "secret",
        port: 6380,
        username: "alice",
      })
    );

    expect(RedisMock).toHaveBeenCalledOnce();
    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        db: 5,
        host: "redis.example.com",
        password: "secret",
        port: 6380,
        username: "alice",
      })
    );
  });

  it("returns success with a non-negative latency on a healthy probe", async () => {
    const fake = buildFakeClient();
    RedisMock.mockImplementation(stubReturn(fake));

    const result = await new RedisDriver().testConnection(params());
    expect(result.success).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message.toLowerCase()).toContain("redis");
    expect(fake.ping).toHaveBeenCalledOnce();
  });

  it("quits the client after a successful probe", async () => {
    const fake = buildFakeClient();
    RedisMock.mockImplementation(stubReturn(fake));

    await new RedisDriver().testConnection(params());
    expect(fake.quit).toHaveBeenCalledWith();
  });

  it("wraps probe errors in DbError and still tears down the client", async () => {
    const fake = buildFakeClient(async () => {
      await Promise.resolve();
      throw new Error("auth failed");
    });
    RedisMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new RedisDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("auth failed");
    expect(fake.quit).toHaveBeenCalledWith();
  });

  it("falls back to disconnect when quit throws", async () => {
    const fake = buildFakeClient();
    fake.quit.mockRejectedValueOnce(new Error("connection lost"));
    RedisMock.mockImplementation(stubReturn(fake));

    await new RedisDriver().testConnection(params());
    expect(fake.disconnect).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError", async () => {
    RedisMock.mockImplementation(stubThrow(new Error("invalid options")));
    let caught: unknown;
    try {
      await new RedisDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("invalid options");
  });
});

describe("redisDriver.connect", () => {
  beforeEach(() => {
    RedisMock.mockReset();
  });

  it("returns a RedisPool after a healthy probe", async () => {
    const fake = buildFakeClient();
    RedisMock.mockImplementation(stubReturn(fake));

    const pool = await new RedisDriver().connect("conn-1", params());
    expect(pool).toBeInstanceOf(RedisPool);
    expect(fake.ping).toHaveBeenCalledOnce();
    expect(fake.quit).not.toHaveBeenCalled();
  });

  it("rejects with DbError and tears down the client when the probe fails", async () => {
    const fake = buildFakeClient(async () => {
      await Promise.resolve();
      throw new Error("WRONGPASS");
    });
    RedisMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new RedisDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("WRONGPASS");
    expect(fake.quit).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError without calling ping", async () => {
    RedisMock.mockImplementation(stubThrow(new Error("dns failure")));
    let caught: unknown;
    try {
      await new RedisDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("dns failure");
  });
});
