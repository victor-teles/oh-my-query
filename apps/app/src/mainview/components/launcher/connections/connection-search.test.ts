import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";

import {
  connectionSubtitle,
  databaseTypeLabel,
  filterConnections,
  sortConnections,
} from "./connection-search";

const names = (list: { name: string }[]) => list.map((item) => item.name);

describe("sortConnections", () => {
  it("puts pinned first, then most recently used, then by name", () => {
    const sorted = sortConnections([
      makeConnection({ id: "a", name: "zeta" }),
      makeConnection({
        id: "b",
        lastConnectedAt: "2026-11-10T00:00:00.000Z",
        name: "recent",
      }),
      makeConnection({ id: "c", name: "alpha" }),
      makeConnection({ id: "d", name: "pinned", pinned: true }),
      makeConnection({
        id: "e",
        lastConnectedAt: "2026-11-12T00:00:00.000Z",
        name: "newest",
      }),
    ]);

    expect(names(sorted)).toStrictEqual([
      "pinned",
      "newest",
      "recent",
      "alpha",
      "zeta",
    ]);
  });
});

describe("filterConnections", () => {
  const connections = [
    makeConnection({ environment: "prod", id: "a", name: "billing" }),
    makeConnection({
      database: "events",
      host: "ch.internal",
      id: "b",
      name: "warehouse",
      type: "clickhouse",
    }),
  ];

  it("returns everything sorted for a blank query", () => {
    expect(names(filterConnections(connections, "  "))).toStrictEqual([
      "billing",
      "warehouse",
    ]);
  });

  it("matches name, host, database, type and environment", () => {
    expect(names(filterConnections(connections, "ware"))).toStrictEqual([
      "warehouse",
    ]);
    expect(names(filterConnections(connections, "events"))).toStrictEqual([
      "warehouse",
    ]);
    expect(names(filterConnections(connections, "clickh"))).toStrictEqual([
      "warehouse",
    ]);
    expect(names(filterConnections(connections, "prod"))).toStrictEqual([
      "billing",
    ]);
  });

  it("drops connections that do not match", () => {
    expect(filterConnections(connections, "zzz")).toStrictEqual([]);
  });
});

describe("connectionSubtitle", () => {
  it("shows type and host/database for servers", () => {
    expect(connectionSubtitle(makeConnection())).toBe(
      "PostgreSQL · localhost/analytics"
    );
  });

  it("shows only the host when no database is set", () => {
    expect(
      connectionSubtitle(
        makeConnection({ database: "", host: "cache", type: "redis" })
      )
    ).toBe("Redis · cache");
  });

  it("shows the file name for file databases", () => {
    expect(
      connectionSubtitle(
        makeConnection({ database: "/data/shop.duckdb", type: "duckdb" })
      )
    ).toBe("DuckDB · shop.duckdb");
  });

  it("labels every database type", () => {
    expect(databaseTypeLabel("mssql")).toBe("SQL Server");
  });
});
