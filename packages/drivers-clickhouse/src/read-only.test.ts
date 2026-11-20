import type { ClickHouseClient } from "@clickhouse/client";
import type { TabularResult } from "@oh-my-query/core";

import { createClient } from "@clickhouse/client";
import { afterAll, describe, expect, it, vi } from "vitest";

import { ClickhousePool } from "./pool.ts";

const signal = () => new AbortController().signal;

const fakePool = () => {
  const json = vi.fn().mockResolvedValue({ data: [], meta: [] });
  const query = vi
    .fn<(params: Record<string, unknown>) => Promise<{ json: typeof json }>>()
    .mockResolvedValue({ json });
  const client = { close: vi.fn(), query } as unknown as ClickHouseClient;
  const pool = new ClickhousePool({
    defaultClient: client,
    defaultDatabase: "default",
  });
  return { pool, query };
};

describe("clickhousePool.execute read-only", () => {
  it("sends the readonly setting with the query", async () => {
    const { pool, query } = fakePool();
    await pool.execute("select 1", 10, null, signal(), { readOnly: true });
    expect(query.mock.calls[0]?.[0]).toMatchObject({
      clickhouse_settings: { readonly: "1" },
      query: "select 1",
    });
  });

  it("sends no settings when read-only is not requested", async () => {
    const { pool, query } = fakePool();
    await pool.execute("select 1", 10, null, signal());
    expect(query.mock.calls[0]?.[0]).not.toHaveProperty("clickhouse_settings");
  });
});

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("clickhousePool.execute params", () => {
  it("sends params as query_params alongside the readonly setting", async () => {
    const { pool, query } = fakePool();
    const sql = "select {p1:String}, {p2:Date}, {p3:Float64}, {p1:String}";
    await pool.execute(sql, 10, null, signal(), {
      params: [HOSTILE, "2026-03-01", 42],
      readOnly: true,
    });
    expect(query.mock.calls[0]?.[0]).toMatchObject({
      clickhouse_settings: { readonly: "1" },
      query: sql,
      query_params: { p1: HOSTILE, p2: "2026-03-01", p3: 42 },
    });
  });

  it("sends no query_params when params are empty", async () => {
    const { pool, query } = fakePool();
    await pool.execute("select 1", 10, null, signal(), { params: [] });
    expect(query.mock.calls[0]?.[0]).not.toHaveProperty("query_params");
  });
});

const FIXTURE_URL = process.env.OMQ_CLICKHOUSE_URL ?? "http://127.0.0.1:8123";

const connectFixture = async (): Promise<ClickHouseClient | null> => {
  const client = createClient({ request_timeout: 1000, url: FIXTURE_URL });
  const { success } = await client.ping();
  if (success) {
    return client;
  }
  await client.close();
  return null;
};

const fixture = await connectFixture();

describe.skipIf(!fixture)(
  "clickhousePool.execute params (fixture database)",
  () => {
    const client = fixture as ClickHouseClient;
    const pool = new ClickhousePool({
      defaultClient: client,
      defaultDatabase: "default",
    });
    const table = `omq_params_${process.pid}`;

    afterAll(async () => {
      await client.command({ query: `drop table if exists ${table}` });
      await pool.close();
    });

    it("round-trips hostile and quoted params as data under readonly", async () => {
      const result = (await pool.execute(
        "select {p1:String} as v, {p2:String} as w, {p3:Date} as d, {p4:Float64} + 1 as n, {p1:String} as again",
        10,
        null,
        signal(),
        { params: [HOSTILE, QUOTED, "2026-03-01", 41], readOnly: true }
      )) as TabularResult;
      expect(result.rows).toStrictEqual([
        [HOSTILE, QUOTED, "2026-03-01", 42, HOSTILE],
      ]);
    });

    it("filters with a bound value and still rejects writes under readonly", async () => {
      await client.command({
        query: `create table if not exists ${table} (s String) engine = Memory`,
      });
      await client.command({ query: `insert into ${table} values ('a')` });

      const result = (await pool.execute(
        `select toUInt32(count()) from ${table} where s = {p1:String}`,
        10,
        null,
        signal(),
        { params: [HOSTILE], readOnly: true }
      )) as TabularResult;
      expect(result.rows).toStrictEqual([[0]]);

      await expect(
        pool.execute(
          `insert into ${table} values ({p1:String})`,
          10,
          null,
          signal(),
          { params: [HOSTILE], readOnly: true }
        )
      ).rejects.toThrow(/readonly/i);
    });
  }
);
