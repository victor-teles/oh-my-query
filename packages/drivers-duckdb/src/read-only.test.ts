import type { TabularResult } from "@oh-my-query/core";

import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";

import { DuckdbPool } from "./pool.ts";

const signal = () => new AbortController().signal;

const seededPool = async (): Promise<DuckdbPool> => {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  await conn.run("create table t (id integer)");
  await conn.run("insert into t values (1)");
  conn.disconnect();
  return new DuckdbPool(instance);
};

const count = async (pool: DuckdbPool, readOnly: boolean): Promise<unknown> => {
  const result = (await pool.execute(
    "select count(*)::integer as n from t",
    10,
    null,
    signal(),
    { readOnly }
  )) as TabularResult;
  return result.rows[0]?.[0];
};

describe("duckdbPool.execute read-only", () => {
  it("rejects writes inside the read-only transaction", async () => {
    const pool = await seededPool();
    await expect(
      pool.execute("insert into t values (2)", 10, null, signal(), {
        readOnly: true,
      })
    ).rejects.toThrow(/read-only/);
    await expect(
      pool.execute("delete from t", 10, null, signal(), { readOnly: true })
    ).rejects.toThrow(/read-only/);
    await expect(count(pool, true)).resolves.toBe(1);
    await pool.close();
  });

  it("leaves later writes unaffected", async () => {
    const pool = await seededPool();
    await count(pool, true);
    await pool.execute("insert into t values (2)", 10, null, signal());
    await expect(count(pool, false)).resolves.toBe(2);
    await pool.close();
  });
});

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("duckdbPool.execute params", () => {
  it("round-trips hostile and quoted params as data under read-only", async () => {
    const pool = await seededPool();
    const result = (await pool.execute(
      "select ? as v, ? as w, ?::date::varchar as d, ? + 1 as n",
      10,
      null,
      signal(),
      { params: [HOSTILE, QUOTED, "2026-03-01", 41], readOnly: true }
    )) as TabularResult;
    expect(result.rows).toStrictEqual([[HOSTILE, QUOTED, "2026-03-01", 42]]);
    await expect(count(pool, true)).resolves.toBe(1);
    await pool.close();
  });

  it("filters with a bound value inside the read-only transaction", async () => {
    const pool = await seededPool();
    const result = (await pool.execute(
      "select count(*)::integer from t where id::varchar = ?",
      10,
      null,
      signal(),
      { params: [HOSTILE], readOnly: true }
    )) as TabularResult;
    expect(result.rows).toStrictEqual([[0]]);
    await pool.close();
  });

  it("still rejects writes when params are bound under read-only", async () => {
    const pool = await seededPool();
    await expect(
      pool.execute("insert into t values (?)", 10, null, signal(), {
        params: [2],
        readOnly: true,
      })
    ).rejects.toThrow(/read-only/);
    await expect(count(pool, false)).resolves.toBe(1);
    await pool.close();
  });
});
