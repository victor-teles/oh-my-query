import type { Document } from "mongodb";

import { DbError } from "@oh-my-query/core";
import {
  Binary,
  Decimal128,
  Double,
  Int32,
  Long,
  MongoClient,
  ObjectId,
  Timestamp,
  UUID,
} from "mongodb";
import { afterAll, describe, expect, it, vi } from "vitest";

import { MongoPool } from "./pool.ts";
import { runMongoReadQuery, toPlainValue } from "./read-query.ts";

const signal = () => new AbortController().signal;

const fakePool = (documents: Document[] = []) => {
  const toArray = vi.fn().mockResolvedValue(documents);
  const aggregate = vi.fn(() => ({ toArray }));
  const collection = vi.fn(() => ({ aggregate }));
  const db = vi.fn(() => ({ collection }));
  const pool = new MongoPool(
    { close: vi.fn(), db } as unknown as MongoClient,
    "shop"
  );
  return { aggregate, collection, db, pool, toArray };
};

const ORDERS_BY_STATUS = JSON.stringify({
  collection: "orders",
  description: "Orders by status",
  pipeline: [
    { $match: { created_at: { $gte: { $date: "2026-01-01T00:00:00Z" } } } },
    { $group: { _id: "$status", orders: { $sum: 1 } } },
    { $project: { _id: 0, orders: 1, status: "$_id" } },
  ],
});

describe("runMongoReadQuery", () => {
  it("runs the pipeline with a row cap, a time limit and the signal", async () => {
    const { aggregate, collection, db, pool } = fakePool([
      { orders: 3, status: "paid" },
    ]);
    const abort = signal();
    const result = await runMongoReadQuery(
      pool,
      ORDERS_BY_STATUS,
      "shop",
      2000,
      abort
    );

    expect([db.mock.calls[0], collection.mock.calls[0]]).toStrictEqual([
      ["shop"],
      ["orders"],
    ]);
    const [pipeline, options] = aggregate.mock.calls[0] as unknown as [
      Document[],
      Document,
    ];
    expect(pipeline.at(-1)).toStrictEqual({ $limit: 2001 });
    expect(pipeline[0]?.$match.created_at.$gte).toBeInstanceOf(Date);
    expect(options).toStrictEqual({
      comment: "oh-my-query ask",
      maxTimeMS: 30_000,
      signal: abort,
    });
    expect(result).toMatchObject({
      columns: [
        { name: "orders", typeName: "NUMERIC" },
        { name: "status", typeName: "TEXT" },
      ],
      isTruncated: false,
      resultType: "tabular",
      rowCount: 1,
      rows: [[3, "paid"]],
    });
  });

  it("truncates to maxRows and flags it", async () => {
    const { pool } = fakePool([{ n: 1 }, { n: 2 }, { n: 3 }]);
    const result = await runMongoReadQuery(
      pool,
      ORDERS_BY_STATUS,
      "shop",
      2,
      signal()
    );
    expect(result.rows).toStrictEqual([[1], [2]]);
    expect(result.isTruncated).toBeTruthy();
  });

  it("refuses a write before touching the client", async () => {
    const { db, pool } = fakePool();
    const text = JSON.stringify({
      collection: "orders",
      pipeline: [{ $match: {} }, { $merge: { into: "orders_copy" } }],
    });
    const error = await runMongoReadQuery(pool, text, "shop", 10, signal())
      .then(() => null)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DbError);
    expect(error).toMatchObject({
      code: "NOT_READ_ONLY",
      message: "$merge writes data; only read-only pipelines can run here.",
    });
    expect(db).not.toHaveBeenCalled();
  });

  it("maps driver errors", async () => {
    const { pool, toArray } = fakePool();
    toArray.mockRejectedValue(
      Object.assign(new Error("operation exceeded time limit"), {
        codeName: "MaxTimeMSExpired",
      })
    );
    await expect(
      runMongoReadQuery(pool, ORDERS_BY_STATUS, "shop", 10, signal())
    ).rejects.toMatchObject({ code: "MaxTimeMSExpired" });
  });

  it("fails cleanly on a closed pool", async () => {
    const { pool } = fakePool();
    await pool.close();
    await expect(
      runMongoReadQuery(pool, ORDERS_BY_STATUS, "shop", 10, signal())
    ).rejects.toMatchObject({ code: "POOL_CLOSED" });
  });

  it("rejects EJSON that does not decode", async () => {
    const { pool } = fakePool();
    const text = JSON.stringify({
      collection: "orders",
      pipeline: [{ $match: { at: { $date: { nope: true } } } }],
    });
    await expect(
      runMongoReadQuery(pool, text, "shop", 10, signal())
    ).rejects.toBeInstanceOf(DbError);
  });
});

describe("toPlainValue", () => {
  it("maps BSON values to plain scalars", () => {
    const id = new ObjectId("65f1c0ffee0000000000abcd");
    const uuid = new UUID("3f2a6b1c-1d2e-4f50-8a9b-0c1d2e3f4a5b");
    expect(
      toPlainValue({
        big: Long.fromString("9007199254740993"),
        binary: new Binary(new Uint8Array([1, 2, 3])),
        count: new Int32(7),
        decimal: Decimal128.fromString("12.50"),
        hugeDecimal: Decimal128.fromString("1E+400"),
        id,
        long: Long.fromNumber(42),
        nested: [{ at: new Date("2026-01-01T00:00:00Z") }],
        nothing: null,
        ratio: new Double(0.25),
        stamp: new Timestamp({ i: 1, t: 2 }),
        uuid,
      })
    ).toStrictEqual({
      big: "9007199254740993",
      binary: "<binary 3 bytes>",
      count: 7,
      decimal: 12.5,
      hugeDecimal: "1E+400",
      id: "65f1c0ffee0000000000abcd",
      long: 42,
      nested: [{ at: "2026-01-01T00:00:00.000Z" }],
      nothing: null,
      ratio: 0.25,
      stamp: String(new Timestamp({ i: 1, t: 2 })),
      uuid: "3f2a6b1c-1d2e-4f50-8a9b-0c1d2e3f4a5b",
    });
  });

  it("drops invalid dates and keeps primitives", () => {
    expect(toPlainValue(new Date(Number.NaN))).toBeNull();
    expect(toPlainValue(null)).toBeNull();
    expect(toPlainValue("x")).toBe("x");
    expect(toPlainValue(true)).toBeTruthy();
  });
});

const ignore = (error: unknown): unknown => error;

const FIXTURE_URL =
  process.env.OMQ_MONGO_URL ??
  "mongodb://omq:omq@127.0.0.1:27017/?authSource=admin";

const connectFixture = async (): Promise<MongoClient | null> => {
  const client = new MongoClient(FIXTURE_URL, {
    connectTimeoutMS: 3000,
    serverSelectionTimeoutMS: 3000,
  });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    return client;
  } catch {
    await client.close().catch(ignore);
    return null;
  }
};

const fixture = await connectFixture();

describe.skipIf(!fixture)("runMongoReadQuery (fixture database)", () => {
  const client = fixture as MongoClient;
  const pool = new MongoPool(client, "oh_my_query");
  const database = "oh_my_query";
  const name = `omq_ask_${process.pid}`;
  const target = `${name}_copy`;
  const orders = () => client.db(database).collection(name);

  afterAll(async () => {
    await orders().drop().catch(ignore);
    await client.db(database).collection(target).drop().catch(ignore);
    await client.close();
  });

  it("answers a real pipeline and refuses $merge before the server sees it", async () => {
    await orders().insertMany([
      { created_at: new Date("2026-02-01"), status: "paid", total: 10 },
      { created_at: new Date("2026-02-02"), status: "paid", total: 15 },
      { created_at: new Date("2026-02-03"), status: "refunded", total: 5 },
    ]);
    const answer = await runMongoReadQuery(
      pool,
      JSON.stringify({
        collection: name,
        pipeline: [
          {
            $match: { created_at: { $gte: { $date: "2026-01-01T00:00:00Z" } } },
          },
          { $group: { _id: "$status", orders: { $sum: 1 } } },
          { $sort: { orders: -1 } },
          { $project: { _id: 0, orders: 1, status: "$_id" } },
        ],
      }),
      database,
      2000,
      signal()
    );
    expect(answer.rows).toStrictEqual([
      [2, "paid"],
      [1, "refunded"],
    ]);

    await expect(
      runMongoReadQuery(
        pool,
        JSON.stringify({
          collection: name,
          pipeline: [{ $match: {} }, { $merge: { into: target } }],
        }),
        database,
        2000,
        signal()
      )
    ).rejects.toMatchObject({ code: "NOT_READ_ONLY" });
    const collections = await client
      .db(database)
      .listCollections({ name: target })
      .toArray();
    expect(collections).toStrictEqual([]);
  });

  it("stops a slow pipeline when the signal aborts", async () => {
    const heavy = client.db(database).collection(`${name}_heavy`);
    await heavy.insertMany(Array.from({ length: 1500 }, (_, n) => ({ n })));
    const controller = new AbortController();
    const started = performance.now();
    const slow = runMongoReadQuery(
      pool,
      JSON.stringify({
        collection: `${name}_heavy`,
        pipeline: [
          {
            $lookup: {
              as: "pairs",
              from: `${name}_heavy`,
              let: { outer: "$n" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $lt: [
                        {
                          $size: {
                            $range: [0, { $add: [20_000, "$$outer", "$n"] }],
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
              ],
            },
          },
          { $match: { pairs: { $size: 0 } } },
          { $count: "rows" },
        ],
      }),
      database,
      2000,
      controller.signal
    );
    setTimeout(() => controller.abort(), 300);
    try {
      await expect(slow).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
      expect(performance.now() - started).toBeLessThan(5000);
    } finally {
      await heavy.drop().catch(ignore);
    }
  }, 20_000);
});
