import type { TabularResult } from "@conch/core";
import type { Database } from "bun:sqlite";

import { describe, expect, it, vi } from "vitest";

import { SqlitePool } from "./pool.ts";

const signal = () => new AbortController().signal;

const fakeDb = (failing = false) => {
  const log: string[] = [];
  const statement = {
    columnNames: ["n"],
    columnTypes: ["INTEGER"],
    values: vi.fn(() => {
      if (failing) {
        throw Object.assign(new Error("attempt to write a readonly database"), {
          code: "SQLITE_READONLY",
        });
      }
      return [[1]];
    }),
  };
  const db = {
    query: vi.fn((sql: string) => {
      log.push(sql);
      return statement;
    }),
    run: vi.fn((sql: string) => {
      log.push(sql);
    }),
  };
  return { db: db as unknown as Database, log, statement };
};

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("sqlitePool.execute read-only", () => {
  it("turns query_only on for the call and restores it", async () => {
    const { db, log } = fakeDb();
    const pool = new SqlitePool(db, "sqlite");
    await pool.execute("select 1 as n", 10, null, signal(), { readOnly: true });
    expect(log).toStrictEqual([
      "PRAGMA query_only = ON",
      "select 1 as n",
      "PRAGMA query_only = OFF",
    ]);
  });

  it("restores query_only when the statement fails", async () => {
    const { db, log } = fakeDb(true);
    const pool = new SqlitePool(db, "sqlite");
    await expect(
      pool.execute("select 1 as n", 10, null, signal(), { readOnly: true })
    ).rejects.toMatchObject({ code: "SQLITE_READONLY" });
    expect(log.at(-1)).toBe("PRAGMA query_only = OFF");
  });

  it("leaves query_only alone when read-only is not requested", async () => {
    const { db, log } = fakeDb();
    const pool = new SqlitePool(db, "sqlite");
    await pool.execute("select 1 as n", 10, null, signal());
    expect(log).toStrictEqual(["select 1 as n"]);
  });
});

describe("sqlitePool.execute params", () => {
  it("binds params on the prepared statement under query_only", async () => {
    const { db, log, statement } = fakeDb();
    const pool = new SqlitePool(db, "sqlite");
    const sql = "select ? as a, ? as b, ? as c";
    await pool.execute(sql, 10, null, signal(), {
      params: [HOSTILE, 42, HOSTILE],
      readOnly: true,
    });
    expect(log).toStrictEqual([
      "PRAGMA query_only = ON",
      sql,
      "PRAGMA query_only = OFF",
    ]);
    expect(statement.values).toHaveBeenCalledWith(HOSTILE, 42, HOSTILE);
  });

  it("binds no values when params are empty", async () => {
    const { db, statement } = fakeDb();
    const pool = new SqlitePool(db, "sqlite");
    await pool.execute("select 1 as n", 10, null, signal(), { params: [] });
    expect(statement.values).toHaveBeenCalledWith();
  });
});

const bunSqlite = await import("bun:sqlite").catch(() => null);

describe.skipIf(!bunSqlite)("sqlitePool.execute params (bun:sqlite)", () => {
  it("round-trips hostile and quoted params as data under query_only", async () => {
    const sqlite = bunSqlite as NonNullable<typeof bunSqlite>;
    const db = new sqlite.Database(":memory:");
    db.run("create table t (id integer)");
    db.run("insert into t values (1)");
    const pool = new SqlitePool(db, "sqlite");

    const result = (await pool.execute(
      "select ? as v, ? as w, ? as n, (select count(*) from t) as c",
      10,
      null,
      signal(),
      { params: [HOSTILE, QUOTED, 7], readOnly: true }
    )) as TabularResult;

    expect(result.rows).toStrictEqual([[HOSTILE, QUOTED, 7, 1]]);
    await pool.close();
  });
});
