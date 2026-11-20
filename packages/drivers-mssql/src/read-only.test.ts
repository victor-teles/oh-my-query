import type { ConnectionPool } from "mssql";

import { describe, expect, it, vi } from "vitest";

import { MssqlPool } from "./pool.ts";

const signal = () => new AbortController().signal;

const fakePool = () => {
  const batches: string[] = [];
  const events: string[] = [];
  const request = {
    cancel: vi.fn(),
    input: vi.fn((name: string) => {
      events.push(`input ${name}`);
    }),
    query: vi.fn((sql: string) => {
      batches.push(sql);
      events.push(sql);
      return Promise.resolve({
        output: {},
        recordset: [],
        recordsets: [],
        rowsAffected: [],
      });
    }),
  };
  const pool = { request: () => request } as unknown as ConnectionPool;
  return { batches, events, pool: new MssqlPool(pool, "master"), request };
};

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("mssqlPool.execute read-only", () => {
  it("runs the statement inside a transaction that is always rolled back", async () => {
    const { batches, pool } = fakePool();
    await pool.execute("select 1 as n;  ", 10, null, signal(), {
      readOnly: true,
    });
    expect(batches).toStrictEqual([
      "BEGIN TRANSACTION;\nselect 1 as n\n;\nIF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;",
    ]);
  });

  it("closes a trailing line comment before the rollback", async () => {
    const { batches, pool } = fakePool();
    await pool.execute("select 1 -- note", 10, null, signal(), {
      readOnly: true,
    });
    expect(batches[0]?.split("\n")).toStrictEqual([
      "BEGIN TRANSACTION;",
      "select 1 -- note",
      ";",
      "IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;",
    ]);
  });

  it("sends the statement unchanged when read-only is not requested", async () => {
    const { batches, pool } = fakePool();
    await pool.execute("select 1", 10, null, signal());
    expect(batches).toStrictEqual(["select 1"]);
  });
});

describe("mssqlPool.execute params", () => {
  it("binds params as named inputs on the rolled-back read-only batch", async () => {
    const { batches, pool, request } = fakePool();
    const sql = "select * from t where a = @p1 and b = @p2 and c = @p1";
    await pool.execute(sql, 10, null, signal(), {
      params: [HOSTILE, 42],
      readOnly: true,
    });
    expect(request.input.mock.calls).toStrictEqual([
      ["p1", HOSTILE],
      ["p2", 42],
    ]);
    expect(batches).toStrictEqual([
      `BEGIN TRANSACTION;\n${sql}\n;\nIF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;`,
    ]);
  });

  it("binds inputs after switching database so USE is not parameterized", async () => {
    const { events, pool, request } = fakePool();
    await pool.execute("select @p1", 10, "analytics", signal(), {
      params: [QUOTED],
    });
    expect(events).toStrictEqual(["USE [analytics]", "input p1", "select @p1"]);
    expect(request.input).toHaveBeenCalledWith("p1", QUOTED);
  });

  it("adds no inputs when params are empty", async () => {
    const { pool, request } = fakePool();
    await pool.execute("select 1", 10, null, signal(), { params: [] });
    expect(request.input).not.toHaveBeenCalled();
  });
});
