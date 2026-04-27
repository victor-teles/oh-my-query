import { describe, expect, it } from "vitest";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

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
import { mockTauri } from "@/test/tauri-mock";

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

const setupStore = (
  initial: DatabaseConnection[] = []
): DatabaseConnection[] => {
  const store = initial.map((c) => ({ ...c }));
  mockTauri({
    getConnections: () => store,
    saveConnections: (payload) => {
      store.length = 0;
      store.push(...(payload.connections as DatabaseConnection[]));
    },
  });
  return store;
};

describe("isSqlDatabase predicate", () => {
  it.each<DatabaseType>([
    "postgresql",
    "mysql",
    "sqlite",
    "clickhouse",
    "duckdb",
    "mssql",
  ])("returns true for %s", (type) => {
    expect(isSqlDatabase(type)).toBeTruthy();
  });

  it.each<DatabaseType>(["mongodb", "redis"])(
    "returns false for %s",
    (type) => {
      expect(isSqlDatabase(type)).toBeFalsy();
    }
  );
});

describe("default ports", () => {
  it.each<[DatabaseType, number]>([
    ["postgresql", 5432],
    ["mysql", 3306],
    ["redis", 6379],
    ["mongodb", 27_017],
    ["clickhouse", 8123],
    ["mssql", 1433],
    ["duckdb", 0],
    ["sqlite", 0],
  ])("maps %s to port %i", (type, port) => {
    expect(DEFAULT_PORTS[type]).toBe(port);
  });
});

describe("connections CRUD (RPC wrapper)", () => {
  it("returns empty list when nothing stored", async () => {
    setupStore();
    await expect(getConnections()).resolves.toStrictEqual([]);
  });

  it("normalizes legacy entries missing pinned/lastConnectedAt", async () => {
    setupStore([
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
    setupStore();
    const conn = makeConnection({ id: "abc", name: "alpha" });
    await saveConnection(conn);

    const list = await getConnections();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("alpha");
  });

  it("updates an existing connection by id", async () => {
    const conn = makeConnection({ id: "abc", name: "alpha" });
    setupStore([conn]);

    await updateConnection({ ...conn, name: "renamed" });

    const [updated] = await getConnections();
    expect(updated?.name).toBe("renamed");
  });

  it("deletes a connection by id", async () => {
    setupStore([makeConnection({ id: "a" }), makeConnection({ id: "b" })]);

    await deleteConnection("a");

    const list = await getConnections();
    expect(list.map((c) => c.id)).toStrictEqual(["b"]);
  });

  it("toggles pin state", async () => {
    setupStore([makeConnection({ id: "a", pinned: false })]);

    await togglePinConnection("a");
    const afterFirst = await getConnections();
    expect(afterFirst[0]?.pinned).toBeTruthy();

    await togglePinConnection("a");
    const afterSecond = await getConnections();
    expect(afterSecond[0]?.pinned).toBeFalsy();
  });

  it("marks a connection as used with a fresh timestamp", async () => {
    setupStore([makeConnection({ id: "a", lastConnectedAt: null })]);

    const before = Date.now();
    await markConnectionUsed("a");
    const [updated] = await getConnections();

    const timestamp = updated?.lastConnectedAt;
    expect(timestamp).toBeTypeOf("string");
    const at = new Date(timestamp as string).getTime();
    expect(at).toBeGreaterThanOrEqual(before);
  });

  it("leaves other connections untouched when updating one", async () => {
    setupStore([
      makeConnection({ id: "a", name: "alpha" }),
      makeConnection({ id: "b", name: "beta" }),
    ]);

    await updateConnection(makeConnection({ id: "a", name: "alpha-updated" }));

    const list = await getConnections();
    expect(list.find((c) => c.id === "b")?.name).toBe("beta");
  });
});
