import type { ConnectionParams } from "@oh-my-query/core";
import type * as MongoModule from "mongodb";

import { DbError } from "@oh-my-query/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MongoClientMock = vi.hoisted(() => vi.fn());

vi.mock<typeof MongoModule>(
  import("mongodb"),
  () =>
    ({
      MongoClient: MongoClientMock,
    }) as unknown as typeof MongoModule
);

const { MongoDriver, buildMongoUri, buildMongoClientOptions } =
  await import("./driver.ts");
const { MongoPool } = await import("./pool.ts");

const params = (overrides: Partial<ConnectionParams> = {}): ConnectionParams =>
  ({
    database: "test",
    host: "localhost",
    password: "",
    port: 27_017,
    type: "mongodb",
    username: "",
    ...overrides,
  }) as ConnectionParams;

interface FakeClient {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  command: ReturnType<typeof vi.fn>;
  db: ReturnType<typeof vi.fn>;
}

const buildFakeClient = (
  commandImpl: () => Promise<unknown> = async () => {
    await Promise.resolve();
    return { ok: 1 };
  }
): FakeClient => {
  const command = vi.fn(commandImpl);
  const fake: FakeClient = {
    close: vi.fn(async () => {
      await Promise.resolve();
    }),
    command,
    connect: vi.fn(async () => {
      await Promise.resolve();
    }),
    db: vi.fn(() => ({ command })),
  };
  return fake;
};

const stubReturn = (value: unknown) =>
  function stubReturn() {
    return value;
  };

const stubThrow = (err: unknown) =>
  function stubThrow() {
    throw err;
  };

describe("buildMongoUri", () => {
  it("builds a URI without auth when credentials are empty", () => {
    expect(
      buildMongoUri(params({ host: "db.example.com", port: 27_018 }))
    ).toBe("mongodb://db.example.com:27018/");
  });

  it("uRL-encodes username and password", () => {
    expect(
      buildMongoUri(params({ password: "p@ss/word", username: "user name" }))
    ).toBe("mongodb://user%20name:p%40ss%2Fword@localhost:27017/");
  });

  it("omits password colon when only username is present", () => {
    expect(buildMongoUri(params({ password: "", username: "alice" }))).toBe(
      "mongodb://alice@localhost:27017/"
    );
  });
});

describe("buildMongoClientOptions", () => {
  it("sets the provided appName and a serverSelectionTimeoutMS", () => {
    const options = buildMongoClientOptions(params(), "mongodb");
    expect(options.appName).toBe("mongodb");
    expect(options.serverSelectionTimeoutMS).toBe(10_000);
    expect(options.authSource).toBeUndefined();
    expect(options.tls).toBeUndefined();
  });

  it("passes authSource through when set", () => {
    const options = buildMongoClientOptions(
      params({ authSource: "admin" }),
      "mongodb"
    );
    expect(options.authSource).toBe("admin");
  });

  it("enables tls and allows invalid certs when trustServerCertificate is true", () => {
    const options = buildMongoClientOptions(
      params({ trustServerCertificate: true }),
      "mongodb"
    );
    expect(options.tls).toBeTruthy();
    expect(options.tlsAllowInvalidCertificates).toBeTruthy();
  });
});

describe("mongoDriver", () => {
  beforeEach(() => {
    MongoClientMock.mockReset();
  });

  it("identifies as mongodb", () => {
    expect(new MongoDriver().dbType).toBe("mongodb");
  });
});

describe("mongoDriver.testConnection", () => {
  beforeEach(() => {
    MongoClientMock.mockReset();
  });

  it("constructs a MongoClient with the expected URI and options", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    await new MongoDriver().testConnection(
      params({
        authSource: "admin",
        host: "db.example.com",
        password: "secret",
        port: 27_020,
        username: "alice",
      })
    );

    expect(MongoClientMock).toHaveBeenCalledWith(
      "mongodb://alice:secret@db.example.com:27020/",
      expect.objectContaining({
        appName: "mongodb",
        authSource: "admin",
        serverSelectionTimeoutMS: 10_000,
      })
    );
  });

  it("returns success with non-negative latency on a healthy probe", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    const result = await new MongoDriver().testConnection(params());
    expect(result.success).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message.toLowerCase()).toContain("mongodb");
    expect(fake.connect).toHaveBeenCalledOnce();
  });

  it("issues the ping command against the configured database", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    await new MongoDriver().testConnection(params({ database: "myapp" }));
    expect(fake.db).toHaveBeenCalledWith("myapp");
    expect(fake.command).toHaveBeenCalledWith({ ping: 1 });
  });

  it("falls back to the admin db when params.database is empty", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    await new MongoDriver().testConnection(params({ database: "" }));
    expect(fake.db).toHaveBeenCalledWith("admin");
  });

  it("closes the client after a successful probe", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    await new MongoDriver().testConnection(params());
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps probe errors in DbError and still closes the client", async () => {
    const fake = buildFakeClient(async () => {
      await Promise.resolve();
      throw Object.assign(new Error("auth failed"), {
        codeName: "AuthenticationFailed",
      });
    });
    MongoClientMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new MongoDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe("AuthenticationFailed");
    expect((caught as DbError).message).toBe("auth failed");
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("swallows close failures during cleanup", async () => {
    const fake = buildFakeClient();
    fake.close.mockRejectedValueOnce(new Error("already closing"));
    MongoClientMock.mockImplementation(stubReturn(fake));

    await expect(
      new MongoDriver().testConnection(params())
    ).resolves.toStrictEqual(expect.objectContaining({ success: true }));
  });

  it("wraps construction failures in DbError", async () => {
    MongoClientMock.mockImplementation(stubThrow(new Error("invalid options")));

    let caught: unknown;
    try {
      await new MongoDriver().testConnection(params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("invalid options");
  });
});

describe("mongoDriver.connect", () => {
  beforeEach(() => {
    MongoClientMock.mockReset();
  });

  it("returns a MongoPool after a healthy probe and does not close the client", async () => {
    const fake = buildFakeClient();
    MongoClientMock.mockImplementation(stubReturn(fake));

    const pool = await new MongoDriver().connect("conn-1", params());
    expect(pool).toBeInstanceOf(MongoPool);
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.command).toHaveBeenCalledWith({ ping: 1 });
    expect(fake.close).not.toHaveBeenCalled();
  });

  it("rejects with DbError and closes the client when probe fails", async () => {
    const fake = buildFakeClient(async () => {
      await Promise.resolve();
      throw new Error("WRONGPASS");
    });
    MongoClientMock.mockImplementation(stubReturn(fake));

    let caught: unknown;
    try {
      await new MongoDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("WRONGPASS");
    expect(fake.close).toHaveBeenCalledWith();
  });

  it("wraps construction failures in DbError without calling connect", async () => {
    MongoClientMock.mockImplementation(stubThrow(new Error("dns failure")));

    let caught: unknown;
    try {
      await new MongoDriver().connect("conn-1", params());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).message).toBe("dns failure");
  });
});
