import { describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";

import {
  DEFAULT_PORTS,
  deleteConnection,
  getConnections,
  isSqlDatabase,
  markConnectionUsed,
  saveConnection,
  togglePinConnection,
  updateConnection,
} from "@/lib/connections";

const STORAGE_KEY = "oh-my-query-connections";

const makeConnection = (
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection => ({
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: overrides.id ?? crypto.randomUUID(),
  lastConnectedAt: null,
  name: "local",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
  ...overrides,
});

const seed = (connections: DatabaseConnection[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};

describe("isSqlDatabase predicate", () => {
  it("returns true for SQL databases", () => {
    expect(isSqlDatabase("postgresql")).toBeTruthy();
    expect(isSqlDatabase("mysql")).toBeTruthy();
    expect(isSqlDatabase("sqlite")).toBeTruthy();
    expect(isSqlDatabase("clickhouse")).toBeTruthy();
  });

  it("returns false for non-SQL databases", () => {
    expect(isSqlDatabase("mongodb")).toBeFalsy();
    expect(isSqlDatabase("redis")).toBeFalsy();
  });
});

describe("default ports", () => {
  it("maps each database type to a port", () => {
    expect(DEFAULT_PORTS.postgresql).toBe(5432);
    expect(DEFAULT_PORTS.mysql).toBe(3306);
    expect(DEFAULT_PORTS.redis).toBe(6379);
    expect(DEFAULT_PORTS.mongodb).toBe(27_017);
    expect(DEFAULT_PORTS.clickhouse).toBe(8123);
  });
});

describe("connections CRUD (browser/localStorage mode)", () => {
  it("returns empty list when nothing stored", async () => {
    await expect(getConnections()).resolves.toStrictEqual([]);
  });

  it("normalizes legacy entries missing pinned/lastConnectedAt", async () => {
    seed([
      {
        createdAt: "2024-01-01T00:00:00.000Z",
        database: "app",
        host: "localhost",
        id: "legacy",
        name: "legacy",
        password: "",
        port: 5432,
        type: "postgresql",
        username: "postgres",
      } as DatabaseConnection,
    ]);

    const [conn] = await getConnections();
    expect(conn?.pinned).toBeFalsy();
    expect(conn?.lastConnectedAt).toBeNull();
  });

  it("saves a new connection", async () => {
    const conn = makeConnection({ id: "abc", name: "alpha" });
    await saveConnection(conn);

    const list = await getConnections();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("alpha");
  });

  it("updates an existing connection by id", async () => {
    const conn = makeConnection({ id: "abc", name: "alpha" });
    seed([conn]);

    await updateConnection({ ...conn, name: "renamed" });

    const [updated] = await getConnections();
    expect(updated?.name).toBe("renamed");
  });

  it("deletes a connection by id", async () => {
    seed([makeConnection({ id: "a" }), makeConnection({ id: "b" })]);

    await deleteConnection("a");

    const list = await getConnections();
    expect(list.map((c) => c.id)).toStrictEqual(["b"]);
  });

  it("toggles pin state", async () => {
    seed([makeConnection({ id: "a", pinned: false })]);

    await togglePinConnection("a");
    const afterFirst = await getConnections();
    expect(afterFirst[0]?.pinned).toBeTruthy();

    await togglePinConnection("a");
    const afterSecond = await getConnections();
    expect(afterSecond[0]?.pinned).toBeFalsy();
  });

  it("marks a connection as used with a fresh timestamp", async () => {
    seed([makeConnection({ id: "a", lastConnectedAt: null })]);

    const before = Date.now();
    await markConnectionUsed("a");
    const [updated] = await getConnections();

    const timestamp = updated?.lastConnectedAt;
    expect(timestamp).toBeTypeOf("string");
    const at = new Date(timestamp as string).getTime();
    expect(at).toBeGreaterThanOrEqual(before);
  });

  it("leaves other connections untouched when updating one", async () => {
    seed([
      makeConnection({ id: "a", name: "alpha" }),
      makeConnection({ id: "b", name: "beta" }),
    ]);

    await updateConnection(makeConnection({ id: "a", name: "alpha-updated" }));

    const list = await getConnections();
    expect(list.find((c) => c.id === "b")?.name).toBe("beta");
  });
});
