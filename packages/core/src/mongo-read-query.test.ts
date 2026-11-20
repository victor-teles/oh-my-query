import { describe, expect, it } from "vitest";

import { MONGO_READ_STAGES, parseMongoReadQuery } from "./mongo-read-query.ts";

const query = (pipeline: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ collection: "orders", pipeline, ...extra });

const reasonOf = (text: string): string | null => {
  const parsed = parseMongoReadQuery(text);
  return parsed.ok ? null : parsed.reason;
};

const MINIMAL_STAGES: Record<(typeof MONGO_READ_STAGES)[number], unknown> = {
  $addFields: { total_usd: { $divide: ["$total_cents", 100] } },
  $bucket: { boundaries: [0, 100, 1000], default: "other", groupBy: "$total" },
  $bucketAuto: { buckets: 4, groupBy: "$total" },
  $count: "orders",
  $densify: { field: "day", range: { bounds: "full", step: 1, unit: "day" } },
  $fill: { output: { total: { value: 0 } } },
  $geoNear: { distanceField: "distance", near: [0, 0] },
  $graphLookup: {
    as: "chain",
    connectFromField: "manager_id",
    connectToField: "_id",
    from: "employees",
    startWith: "$manager_id",
  },
  $group: { _id: "$status", orders: { $sum: 1 } },
  $limit: 10,
  $lookup: {
    as: "customer",
    foreignField: "_id",
    from: "customers",
    localField: "customer_id",
  },
  $match: { status: "paid" },
  $project: { _id: 0, status: 1 },
  $replaceRoot: { newRoot: "$customer" },
  $replaceWith: "$customer",
  $sample: { size: 5 },
  $set: { year: { $year: "$created_at" } },
  $setWindowFields: {
    output: { running: { $sum: "$total", window: { documents: [-1, 0] } } },
    sortBy: { created_at: 1 },
  },
  $skip: 5,
  $sort: { created_at: -1 },
  $sortByCount: "$status",
  $unionWith: "archived_orders",
  $unset: "notes",
  $unwind: "$items",
};

describe("parseMongoReadQuery", () => {
  it.each(MONGO_READ_STAGES)("allows %s", (stage) => {
    const parsed = parseMongoReadQuery(
      query([{ [stage]: MINIMAL_STAGES[stage] }])
    );
    expect(parsed).toMatchObject({ ok: true });
  });

  it("passes a realistic pipeline and keeps its fields", () => {
    const text = query(
      [
        { $match: { created_at: { $gte: { $date: "2026-01-01T00:00:00Z" } } } },
        {
          $lookup: {
            as: "customer",
            from: "customers",
            let: { id: "$customer_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$id"] } } },
              { $project: { region: 1 } },
            ],
          },
        },
        { $unwind: "$customer" },
        { $group: { _id: "$status", orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
        { $project: { _id: 0, orders: 1, status: "$_id" } },
      ],
      { description: "Orders by status" }
    );
    expect(parseMongoReadQuery(text)).toStrictEqual({
      ok: true,
      query: JSON.parse(text),
    });
  });

  it.each([
    ["$out", [{ $out: "copy" }]],
    ["$merge", [{ $merge: { into: "copy" } }]],
    [
      "$merge",
      [
        {
          $lookup: {
            as: "x",
            from: "customers",
            pipeline: [{ $merge: { into: "copy" } }],
          },
        },
      ],
    ],
    ["$where", [{ $match: { $where: "this.total > 10" } }]],
    [
      "$function",
      [
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $function: { args: [], body: "return 1", lang: "js" },
              },
            },
          },
        },
      ],
    ],
    ["$accumulator", [{ $group: { _id: null, t: { $accumulator: {} } } }]],
    ["$currentOp", [{ $currentOp: {} }]],
    ["$listSessions", [{ $listSessions: {} }]],
    ["$listLocalSessions", [{ $listLocalSessions: {} }]],
    ["$planCacheStats", [{ $planCacheStats: {} }]],
    ["$changeStream", [{ $changeStream: {} }]],
    ["$collStats", [{ $collStats: { count: {} } }]],
    ["$indexStats", [{ $indexStats: {} }]],
    [
      "$out",
      [
        {
          $unionWith: {
            coll: "archived_orders",
            pipeline: [{ $match: {} }, { $out: "x" }],
          },
        },
      ],
    ],
  ])("rejects %s wherever it appears", (token, pipeline) => {
    const reason = reasonOf(query(pipeline));
    expect(reason).toMatch(new RegExp(`^\\${token} `));
    expect(reason).toContain("only read-only pipelines can run here");
  });

  it("names the token when a write hides in a nested pipeline", () => {
    expect(
      reasonOf(
        query([
          {
            $lookup: {
              as: "x",
              from: "customers",
              pipeline: [{ $merge: { into: "copy" } }],
            },
          },
        ])
      )
    ).toBe("$merge writes data; only read-only pipelines can run here.");
  });

  it("rejects stages outside the allowlist, including nested ones", () => {
    expect(reasonOf(query([{ $facet: {} }]))).toBe(
      "$facet is not an allowed pipeline stage."
    );
    expect(
      reasonOf(
        query([
          {
            $lookup: { as: "x", from: "c", pipeline: [{ $documents: [] }] },
          },
        ])
      )
    ).toBe("$documents is not an allowed pipeline stage.");
    expect(
      reasonOf(
        query([{ $unionWith: { coll: "c", pipeline: [{ $search: {} }] } }])
      )
    ).toBe("$search is not an allowed pipeline stage.");
  });

  it("rejects a stage with more or fewer than one operator", () => {
    const reason = "Each pipeline stage must have exactly one operator.";
    expect(reasonOf(query([{ $limit: 1, $skip: 1 }]))).toBe(reason);
    expect(reasonOf(query([{}]))).toBe(reason);
  });

  it("only allows $geoNear first", () => {
    expect(
      reasonOf(query([{ $match: {} }, { $geoNear: { near: [0, 0] } }]))
    ).toBe("$geoNear must be the first stage.");
  });

  it("keeps lookups and unions away from system collections", () => {
    expect(
      reasonOf(query([{ $lookup: { as: "u", from: "system.users" } }]))
    ).toBe("$lookup can't read system collections.");
    expect(reasonOf(query([{ $unionWith: "system.profile" }]))).toBe(
      "$unionWith can't read system collections."
    );
    expect(reasonOf(query([{ $unionWith: { coll: "system.views" } }]))).toBe(
      "$unionWith can't read system collections."
    );
    expect(
      reasonOf(query([{ $graphLookup: { as: "g", from: "system.js" } }]))
    ).toBe("$graphLookup can't read system collections.");
    expect(
      reasonOf(
        JSON.stringify({
          collection: "system.users",
          pipeline: [{ $limit: 1 }],
        })
      )
    ).toBe("System collections can't be queried here.");
  });

  it.each([
    [{ $lookup: "customers" }, "$lookup needs an object."],
    [{ $lookup: { as: "x", from: 3 } }, "$lookup must name a collection."],
    [
      { $lookup: { as: "x", from: "c", pipeline: {} } },
      "$lookup.pipeline must be a list of stages.",
    ],
    [{ $lookup: { as: "x", pipeline: [{ $limit: 1 }] } }, null],
    [{ $unionWith: 4 }, "$unionWith needs a collection name or an object."],
    [{ $graphLookup: [] }, "$graphLookup needs an object."],
  ])("checks the shape of %j", (stage, reason) => {
    expect(reasonOf(query([stage]))).toBe(reason);
  });

  it.each([
    ["not JSON", "db.orders.find()"],
    ["an array", "[]"],
    ["a string", '"orders"'],
  ])("rejects a reply that is %s", (_label, text) => {
    expect(reasonOf(text)).toBe("The pipeline is not a valid JSON object.");
  });

  it("rejects wrong types and missing fields", () => {
    const shape =
      'The reply must be {"collection": "<name>", "pipeline": [ … ]}.';
    expect(reasonOf(JSON.stringify({ collection: "orders" }))).toBe(shape);
    expect(reasonOf(query([]))).toBe(shape);
    expect(reasonOf(query([[{ $limit: 1 }]]))).toBe(shape);
    expect(reasonOf(query([{ $limit: 1 }], { description: 4 }))).toBe(shape);
    expect(
      reasonOf(
        JSON.stringify({ collection: "$cmd", pipeline: [{ $limit: 1 }] })
      )
    ).toBe("The collection name is not valid.");
  });

  it("caps the stage count and the size", () => {
    const stages = Array.from({ length: 31 }, () => ({ $limit: 1 }));
    expect(reasonOf(query(stages))).toBe(
      "The pipeline can have at most 30 stages."
    );
    const huge = query([{ $match: { note: "x".repeat(20_001) } }]);
    expect(reasonOf(huge)).toBe("The pipeline is longer than 20 KB.");
  });
});
