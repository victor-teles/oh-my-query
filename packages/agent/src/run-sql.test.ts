import type { TabularResult } from "@oh-my-query/core";
import type { AskEvent } from "@oh-my-query/rpc";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { SqlRunPorts } from "./run-sql.ts";

import { runSql } from "./run-sql.ts";

const tabular = (
  columns: { name: string; typeName: string }[],
  rows: unknown[][]
): TabularResult => ({
  columns,
  executionTimeMs: 4,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

const regions = tabular(
  [
    { name: "region", typeName: "TEXT" },
    { name: "mrr", typeName: "NUMERIC" },
  ],
  [
    ["EMEA", 1200],
    ["APAC", 800],
  ]
);

const makePorts = (
  execute: SqlRunPorts["execute"] = vi
    .fn<SqlRunPorts["execute"]>()
    .mockResolvedValue(regions)
): SqlRunPorts & { execute: ReturnType<typeof vi.fn> } => ({
  connectionLabel: "analytics",
  dialect: "postgresql",
  execute: vi.fn(execute),
});

const collect = async (
  sql: string,
  ports: SqlRunPorts,
  {
    signal = new AbortController().signal,
    title,
  }: { signal?: AbortSignal; title?: string } = {}
): Promise<AskEvent[]> => {
  const events: AskEvent[] = [];
  for await (const event of runSql({ sql, title }, ports, signal)) {
    events.push(event);
  }
  return events;
};

const types = (events: AskEvent[]) => events.map((event) => event.type);
const last = (events: AskEvent[]) => events.at(-1);
const never = <T>(): Promise<T> => Promise.withResolvers<T>().promise;

describe("runSql", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the SQL, runs it read only and draws an inferred card", async () => {
    const ports = makePorts();
    const events = await collect("select region, mrr from revenue", ports);
    expect(types(events)).toStrictEqual([
      "sqlDone",
      "phase",
      "result",
      "card",
      "done",
    ]);
    expect(events[0]).toMatchObject({
      dialect: "postgresql",
      lines: 1,
      sql: "select region, mrr from revenue",
    });
    expect(events[1]).toMatchObject({
      detail: "Read only on analytics",
      phase: "run",
    });
    expect(events[3]).toMatchObject({
      source: "inferred",
      spec: { title: "Query on analytics" },
    });
  });

  it("passes bound parameters to the execute port", async () => {
    const ports = makePorts();
    const events: AskEvent[] = [];
    const input = {
      params: ["ada@example.com"],
      sql: 'SELECT * FROM "users" WHERE "email" = $1 LIMIT 50',
    };
    for await (const event of runSql(
      input,
      ports,
      new AbortController().signal
    )) {
      events.push(event);
    }
    expect(types(events).at(-1)).toBe("done");
    expect(ports.execute).toHaveBeenCalledWith(
      input.sql,
      expect.any(AbortSignal),
      ["ada@example.com"]
    );
  });

  it("draws a KPI for a single number", async () => {
    const one = tabular([{ name: "one", typeName: "INT4" }], [[1]]);
    const events = await collect(
      "select 1 as one",
      makePorts(() => Promise.resolve(one))
    );
    expect(events[3]).toMatchObject({ spec: { view: { kind: "kpi" } } });
  });

  it("titles the card from a leading comment, then the given title", async () => {
    const commented = await collect(
      "-- Revenue by month\nselect region, mrr from revenue",
      makePorts()
    );
    expect(commented[3]).toMatchObject({ spec: { title: "Revenue by month" } });
    const titled = await collect(
      "select region, mrr from revenue",
      makePorts(),
      {
        title: "orders",
      }
    );
    expect(titled[3]).toMatchObject({ spec: { title: "Orders" } });
  });

  it.each([
    ["a write", "delete from orders"],
    ["two statements", "select 1; select 2"],
  ])("refuses %s without running it", async (_label, sql) => {
    const ports = makePorts();
    const events = await collect(sql, ports);
    expect(ports.execute).not.toHaveBeenCalled();
    expect(types(events)).toStrictEqual(["sqlDone", "error"]);
    expect(last(events)).toMatchObject({
      code: "NOT_READ_ONLY",
      phase: "sql",
      sql,
    });
  });

  it("reports the driver's message when the query fails, without repairs", async () => {
    const execute = vi
      .fn<SqlRunPorts["execute"]>()
      .mockRejectedValue(new Error('relation "revenue" does not exist'));
    const ports = makePorts(execute);
    const events = await collect("select * from revenue", ports);
    expect(ports.execute).toHaveBeenCalledOnce();
    expect(last(events)).toMatchObject({
      code: "QUERY_FAILED",
      message: 'relation "revenue" does not exist',
      phase: "run",
      sql: "select * from revenue",
    });
  });

  it("times out after 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ports = makePorts(() => never<TabularResult>());
    const pending = collect("select * from events", ports);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(last(await pending)).toMatchObject({
      code: "TIMEOUT",
      phase: "run",
    });
  });

  it("cancels before running", async () => {
    const controller = new AbortController();
    controller.abort();
    const ports = makePorts();
    const events = await collect("select 1", ports, {
      signal: controller.signal,
    });
    expect(ports.execute).not.toHaveBeenCalled();
    expect(events).toMatchObject([{ code: "CANCELLED", type: "error" }]);
  });

  it("cancels a running query", async () => {
    const controller = new AbortController();
    const ports = makePorts(() => {
      controller.abort();
      return never<TabularResult>();
    });
    const events = await collect("select 1", ports, {
      signal: controller.signal,
    });
    expect(last(events)).toMatchObject({ code: "CANCELLED", phase: "run" });
  });
});
