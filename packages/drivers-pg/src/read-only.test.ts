import type { TabularResult } from "@oh-my-query/core";

import { Pool as PgPool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import { PostgresPool } from "./pool.ts";

const signal = () => new AbortController().signal;

const fakePool = (failOn?: string) => {
  const statements: string[] = [];
  const query = vi.fn((input: string | { text: string }) => {
    const text = typeof input === "string" ? input : input.text;
    statements.push(text);
    if (text === failOn) {
      const error = new Error(
        "cannot execute INSERT in a read-only transaction"
      );
      return Promise.reject(Object.assign(error, { code: "25006" }));
    }
    return Promise.resolve({ fields: [], rows: [] });
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool: new PostgresPool(pool as never), query, statements };
};

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("postgresPool.execute read-only", () => {
  it("wraps the statement in a read-only transaction that always rolls back", async () => {
    const { pool, statements } = fakePool();
    await pool.execute("select 1", 10, "analytics", signal(), {
      readOnly: true,
    });
    expect(statements).toStrictEqual([
      'SET search_path TO "analytics"',
      "BEGIN READ ONLY",
      "select 1",
      "ROLLBACK",
      "RESET search_path",
    ]);
  });

  it("rolls back and surfaces the error when the statement fails", async () => {
    const insert = "insert into t values (1)";
    const { pool, statements } = fakePool(insert);
    await expect(
      pool.execute(insert, 10, null, signal(), { readOnly: true })
    ).rejects.toMatchObject({ code: "25006" });
    expect(statements).toStrictEqual(["BEGIN READ ONLY", insert, "ROLLBACK"]);
  });

  it("runs without a transaction when read-only is not requested", async () => {
    const { pool, statements } = fakePool();
    await pool.execute("select 1", 10, null, signal());
    expect(statements).toStrictEqual(["select 1"]);
  });
});

describe("postgresPool.execute params", () => {
  it("binds params as query values inside the read-only transaction", async () => {
    const { pool, query, statements } = fakePool();
    const sql = "select * from t where a = $1 and b = $2 and c = $1";
    await pool.execute(sql, 10, null, signal(), {
      params: [HOSTILE, 42],
      readOnly: true,
    });
    expect(statements).toStrictEqual(["BEGIN READ ONLY", sql, "ROLLBACK"]);
    expect(query).toHaveBeenCalledWith({
      rowMode: "array",
      text: sql,
      values: [HOSTILE, 42],
    });
  });

  it("binds params without read-only", async () => {
    const { pool, query } = fakePool();
    await pool.execute("select $1::text", 10, null, signal(), {
      params: [QUOTED],
    });
    expect(query).toHaveBeenCalledWith({
      rowMode: "array",
      text: "select $1::text",
      values: [QUOTED],
    });
  });

  it("sends no values when params are empty", async () => {
    const { pool, query } = fakePool();
    await pool.execute("select 1", 10, null, signal(), { params: [] });
    expect(query).toHaveBeenCalledWith({ rowMode: "array", text: "select 1" });
  });
});

const FIXTURE_URL =
  process.env.OMQ_PG_URL ?? "postgres://omq:omq@127.0.0.1:5432/oh_my_query";

const connectFixture = async (): Promise<PgPool | null> => {
  const raw = new PgPool({
    connectionString: FIXTURE_URL,
    connectionTimeoutMillis: 1000,
    max: 2,
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

describe.skipIf(!fixture)(
  "postgresPool.execute read-only (fixture database)",
  () => {
    const raw = fixture as PgPool;
    const pool = new PostgresPool(raw);
    const table = `omq_read_only_${process.pid}`;

    afterAll(async () => {
      await raw.query(`drop table if exists ${table}`);
      await raw.end();
    });

    it("rejects writes and leaves the data untouched", async () => {
      await raw.query(`create table if not exists ${table} (id int)`);
      await raw.query(`insert into ${table} values (1)`);

      await expect(
        pool.execute(`insert into ${table} values (2)`, 10, null, signal(), {
          readOnly: true,
        })
      ).rejects.toMatchObject({ code: "25006" });
      await expect(
        pool.execute(`delete from ${table}`, 10, null, signal(), {
          readOnly: true,
        })
      ).rejects.toMatchObject({ code: "25006" });

      const result = (await pool.execute(
        `select count(*)::int as n from ${table}`,
        10,
        null,
        signal(),
        { readOnly: true }
      )) as TabularResult;
      expect(result.rows).toStrictEqual([[1]]);
    });

    it("round-trips hostile and quoted params as data under read-only", async () => {
      const result = (await pool.execute(
        "select $1::text as v, $2::text as w, $1::text as again, $3::date::text as d",
        10,
        null,
        signal(),
        { params: [HOSTILE, QUOTED, "2026-03-01"], readOnly: true }
      )) as TabularResult;
      expect(result.rows).toStrictEqual([
        [HOSTILE, QUOTED, HOSTILE, "2026-03-01"],
      ]);
    });
  }
);
