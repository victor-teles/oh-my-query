import type { LanguageModel } from "@conch/agent";
import type { DatabaseConnection, TabularResult } from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type { AskEventMessage, RecentAsk } from "@conch/rpc";

import { appendHistory, getConnections } from "@conch/core";
import { runMongoReadQuery, runRedisReadPlan } from "@conch/drivers/read";
import { describe, expect, it, vi } from "vitest";

import type { SchemaCache } from "./schema-cache.ts";

import { createAskService } from "./ask-service.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  appendHistory: vi.fn(),
  getConnections: vi.fn(),
}));

type MongoPool = Parameters<typeof runMongoReadQuery>[0];
type RedisPool = Parameters<typeof runRedisReadPlan>[0];

const { kindOf } = vi.hoisted(() => ({
  kindOf: (pool: unknown): unknown =>
    typeof pool === "object" && pool !== null && "kind" in pool
      ? pool.kind
      : null,
}));

vi.mock(import("@conch/drivers/read"), () => ({
  isMongoPool: (pool: unknown): pool is MongoPool => kindOf(pool) === "mongodb",
  isRedisPool: (pool: unknown): pool is RedisPool => kindOf(pool) === "redis",
  runMongoReadQuery: vi.fn(),
  runRedisReadPlan: vi.fn(),
}));

const connection = (type: string): DatabaseConnection => ({
  createdAt: "2026-11-18T00:00:00.000Z",
  database: type === "redis" ? "0" : "shop",
  host: "127.0.0.1",
  id: `conn-${type}`,
  lastConnectedAt: null,
  name: type === "redis" ? "sessions-cache" : "shop",
  password: "",
  pinned: false,
  port: 1,
  type: type === "redis" ? "redis" : "mongodb",
  username: "",
});

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 1,
    total: 1,
  },
  outputTokens: { reasoning: undefined, text: 1, total: 1 },
};

type MockModel = Extract<LanguageModel, { specificationVersion: "v3" }>;

const scriptedModel = (text: string): MockModel => ({
  doGenerate: vi.fn().mockRejectedValue(new Error("no card today")),
  doStream: vi.fn(async () => {
    await Promise.resolve();
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ id: "t", type: "text-start" });
          controller.enqueue({ delta: text, id: "t", type: "text-delta" });
          controller.enqueue({ id: "t", type: "text-end" });
          controller.enqueue({
            finishReason: { raw: undefined, unified: "stop" },
            type: "finish",
            usage,
          });
          controller.close();
        },
      }),
    };
  }),
  modelId: "test-model",
  provider: "test",
  specificationVersion: "v3",
  supportedUrls: {},
});

const RESULT: TabularResult = {
  columns: [
    { name: "status", typeName: "TEXT" },
    { name: "orders", typeName: "NUMERIC" },
  ],
  executionTimeMs: 3,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 1,
  rows: [["paid", 3]],
};

const PIPELINE = JSON.stringify({
  collection: "orders",
  pipeline: [{ $group: { _id: "$status", orders: { $sum: 1 } } }],
});

const SCAN = JSON.stringify({
  groupBy: "pattern",
  kind: "scan",
  limit: 10,
  match: "*",
  measure: "count",
});

const setup = (kind: string | null, model: LanguageModel | null) => {
  const target = connection(kind ?? "mongodb");
  vi.mocked(getConnections).mockResolvedValue([target]);
  const pool = {
    dialect: null,
    execute: vi.fn(),
    kind,
    listDatabases: vi
      .fn()
      .mockResolvedValue(kind === "redis" ? ["0", "1"] : ["admin", "shop"]),
  };
  const messages: AskEventMessage[] = [];
  const settled = Promise.withResolvers<void>();
  const rememberAsk = vi.fn<(ask: RecentAsk) => Promise<void>>();
  rememberAsk.mockResolvedValue();
  const schemas: SchemaCache = {
    get: vi.fn().mockResolvedValue({ schemas: [] }),
    invalidate: vi.fn(),
  };
  const service = createAskService({
    loadModel: vi.fn().mockResolvedValue(model),
    pools: {
      connect: vi.fn(),
      getPool: vi.fn(() => pool),
      has: vi.fn(() => true),
    } as unknown as ConnectionPoolManager,
    rememberAsk,
    schemas,
    send: (message) => {
      messages.push(message);
      if (message.event.type === "done" || message.event.type === "error") {
        settled.resolve();
      }
    },
  });
  const events = () => messages.map((message) => message.event);
  return {
    events,
    pool,
    rememberAsk,
    schemas,
    service,
    settled: settled.promise,
    target,
  };
};

describe("ask engines in the bun service", () => {
  it("asks MongoDB through the pipeline runner and remembers the language", async () => {
    vi.mocked(runMongoReadQuery).mockResolvedValue(RESULT);
    const { events, pool, rememberAsk, schemas, service, settled, target } =
      setup("mongodb", scriptedModel(PIPELINE));
    service.startAsk({
      askId: "m1",
      connectionId: target.id,
      database: null,
      prompt: "orders by status",
    });
    await settled;

    expect(events()).toContainEqual(
      expect.objectContaining({ dialect: "mongodb", type: "sqlDone" })
    );
    expect(schemas.get).toHaveBeenCalledWith(target.id, "shop");
    expect(runMongoReadQuery).toHaveBeenCalledWith(
      pool,
      PIPELINE,
      "shop",
      2000,
      expect.any(AbortSignal)
    );
    expect(pool.execute).not.toHaveBeenCalled();
    expect([
      vi.mocked(appendHistory).mock.calls.at(-1)?.[0],
      rememberAsk.mock.calls.at(-1)?.[0],
    ]).toMatchObject([
      { dialect: "mongodb", sql: PIPELINE, success: true },
      { dialect: "mongodb", sql: PIPELINE },
    ]);
  });

  it("asks Redis through the plan runner", async () => {
    vi.mocked(runRedisReadPlan).mockResolvedValue(RESULT);
    const { events, pool, rememberAsk, service, settled, target } = setup(
      "redis",
      scriptedModel(SCAN)
    );
    service.startAsk({
      askId: "r1",
      connectionId: target.id,
      database: null,
      prompt: "keys by pattern",
    });
    await settled;

    expect(events().at(-1)).toStrictEqual({ type: "done" });
    expect(events()).toContainEqual({
      detail: "Read only on sessions-cache",
      phase: "run",
      type: "phase",
    });
    expect(runRedisReadPlan).toHaveBeenCalledWith(
      pool,
      SCAN,
      "0",
      2000,
      expect.any(AbortSignal)
    );
    expect(rememberAsk).toHaveBeenCalledWith(
      expect.objectContaining({ dialect: "redis" })
    );
  });

  it("records a failed run in history with the language", async () => {
    vi.mocked(runMongoReadQuery).mockRejectedValue(new Error("bad stage"));
    const { events, service, settled, target } = setup(
      "mongodb",
      scriptedModel(PIPELINE)
    );
    service.startAsk({
      askId: "m2",
      connectionId: target.id,
      database: null,
      prompt: "orders by status",
    });
    await settled;

    expect(events().at(-1)).toMatchObject({ code: "QUERY_FAILED" });
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        dialect: "mongodb",
        error: "bad stage",
        success: false,
      })
    );
  });

  it("still refuses an engine it has no runner for", async () => {
    const { events, service, settled, target } = setup(
      null,
      scriptedModel(PIPELINE)
    );
    service.startAsk({
      askId: "x1",
      connectionId: target.id,
      database: null,
      prompt: "anything",
    });
    await settled;

    expect(events()).toStrictEqual([
      {
        code: "UNSUPPORTED_ENGINE",
        message: "Asking questions doesn't work with this database yet.",
        phase: "schema",
        type: "error",
      },
    ]);
  });

  it("keeps raw SQL runs SQL-only on MongoDB", async () => {
    const { events, service, settled, target } = setup("mongodb", null);
    service.startSqlRun({
      askId: "s1",
      connectionId: target.id,
      database: null,
      source: { kind: "sql", sql: "select 1" },
    });
    await settled;

    expect(events()).toStrictEqual([
      {
        code: "UNSUPPORTED_ENGINE",
        message: "Running SQL works with SQL databases for now.",
        phase: "run",
        type: "error",
      },
    ]);
  });
});
