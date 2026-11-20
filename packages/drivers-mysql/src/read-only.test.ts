import type { TabularResult } from "@conch/core";
import type { Pool as MysqlPoolType } from "mysql2/promise";

import { createPool } from "mysql2/promise";
import { afterAll, describe, expect, it, vi } from "vitest";

import { MysqlPool } from "./pool.ts";

const signal = () => new AbortController().signal;

const fakePool = (failOn?: string) => {
  const statements: string[] = [];
  const query = vi.fn((input: string | { sql: string }) => {
    const sql = typeof input === "string" ? input : input.sql;
    statements.push(sql);
    if (sql === failOn) {
      const error = new Error(
        "Cannot execute statement in a READ ONLY transaction."
      );
      return Promise.reject(
        Object.assign(error, {
          code: "ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION",
        })
      );
    }
    return Promise.resolve([[], []]);
  });
  const execute = vi.fn((input: { sql: string }) => {
    statements.push(input.sql);
    return Promise.resolve([[], []]);
  });
  const conn = { destroy: vi.fn(), execute, query, release: vi.fn() };
  const pool = {
    getConnection: vi.fn().mockResolvedValue(conn),
  } as unknown as MysqlPoolType;
  return { execute, pool: new MysqlPool(pool, "app"), query, statements };
};

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("mysqlPool.execute read-only", () => {
  it("wraps the statement in a read-only transaction that always rolls back", async () => {
    const { pool, statements } = fakePool();
    await pool.execute("select 1", 10, "analytics", signal(), {
      readOnly: true,
    });
    expect(statements).toStrictEqual([
      "USE `analytics`",
      "START TRANSACTION READ ONLY",
      "select 1",
      "ROLLBACK",
      "USE `app`",
    ]);
  });

  it("rolls back and surfaces the error when a write is rejected", async () => {
    const insert = "insert into t values (1)";
    const { pool, statements } = fakePool(insert);
    await expect(
      pool.execute(insert, 10, null, signal(), { readOnly: true })
    ).rejects.toMatchObject({
      code: "ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION",
    });
    expect(statements).toStrictEqual([
      "START TRANSACTION READ ONLY",
      insert,
      "ROLLBACK",
    ]);
  });

  it("runs without a transaction when read-only is not requested", async () => {
    const { pool, statements } = fakePool();
    await pool.execute("select 1", 10, null, signal());
    expect(statements).toStrictEqual(["select 1"]);
  });
});

describe("mysqlPool.execute params", () => {
  it("binds params through a prepared statement inside the read-only transaction", async () => {
    const { execute, pool, query, statements } = fakePool();
    const sql = "select * from t where a = ? and b = ? and c = ?";
    await pool.execute(sql, 10, null, signal(), {
      params: [HOSTILE, 42, HOSTILE],
      readOnly: true,
    });
    expect(statements).toStrictEqual([
      "START TRANSACTION READ ONLY",
      sql,
      "ROLLBACK",
    ]);
    expect(execute).toHaveBeenCalledWith({ rowsAsArray: true, sql }, [
      HOSTILE,
      42,
      HOSTILE,
    ]);
    expect(query).not.toHaveBeenCalledWith(expect.objectContaining({ sql }));
  });

  it("binds params without read-only", async () => {
    const { execute, pool } = fakePool();
    await pool.execute("select ?", 10, null, signal(), { params: [QUOTED] });
    expect(execute).toHaveBeenCalledWith(
      { rowsAsArray: true, sql: "select ?" },
      [QUOTED]
    );
  });

  it("uses a plain query when params are empty", async () => {
    const { execute, pool, query } = fakePool();
    await pool.execute("select 1", 10, null, signal(), { params: [] });
    expect(execute).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith({ rowsAsArray: true, sql: "select 1" });
  });
});

const FIXTURE_URL =
  process.env.OMQ_MYSQL_URL ?? "mysql://omq:omq@127.0.0.1:3306/oh_my_query";

const connectFixture = async (): Promise<MysqlPoolType | null> => {
  const raw = createPool({
    connectTimeout: 1000,
    connectionLimit: 2,
    uri: FIXTURE_URL,
  });
  try {
    await raw.query("select 1");
    return raw;
  } catch {
    await raw.end();
    return null;
  }
};

const fixture = await connectFixture();

describe.skipIf(!fixture)("mysqlPool.execute params (fixture database)", () => {
  const raw = fixture as MysqlPoolType;
  const pool = new MysqlPool(raw, new URL(FIXTURE_URL).pathname.slice(1));
  const table = `conch_params_${process.pid}`;

  afterAll(async () => {
    await raw.query(`drop table if exists ${table}`);
    await raw.end();
  });

  it("round-trips hostile and quoted params as data under read-only", async () => {
    const result = (await pool.execute(
      "select ? as v, ? as w, ? + 1 as n",
      10,
      null,
      signal(),
      { params: [HOSTILE, QUOTED, 41], readOnly: true }
    )) as TabularResult;
    const [row] = result.rows;
    expect(row?.slice(0, 2)).toStrictEqual([HOSTILE, QUOTED]);
    expect(String(row?.[2])).toBe("42");
  });

  it("filters with a bound value and still rejects writes under read-only", async () => {
    await raw.query(`create table if not exists ${table} (s varchar(64))`);
    await raw.query(`insert into ${table} values ('a')`);

    const result = (await pool.execute(
      `select count(*) from ${table} where s = ?`,
      10,
      null,
      signal(),
      { params: [HOSTILE], readOnly: true }
    )) as TabularResult;
    expect(String(result.rows[0]?.[0])).toBe("0");

    await expect(
      pool.execute(`insert into ${table} values (?)`, 10, null, signal(), {
        params: [HOSTILE],
        readOnly: true,
      })
    ).rejects.toThrow(/read only|read-only/i);
    const [rows] = await raw.query(`select count(*) as n from ${table}`);
    expect(rows).toStrictEqual([{ n: 1 }]);
  });
});
