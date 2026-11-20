import type { LanguageModel } from "@conch/agent";
import type { DatabaseConnection, Pool } from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type {
  AskEvent,
  AskEventMessage,
  AskParams,
  RecentAsk,
} from "@conch/rpc";

import { appendHistory, getConnections } from "@conch/core";
import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { SchemaCache } from "./schema-cache.ts";

import { createAskService } from "./ask-service.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  appendHistory: vi.fn(),
  getConnections: vi.fn(),
}));

const connection: DatabaseConnection = {
  createdAt: "2026-11-18T00:00:00.000Z",
  database: "oh_my_query",
  host: "127.0.0.1",
  id: "conn-1",
  lastConnectedAt: null,
  name: "analytics",
  password: "secret",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "conch",
};

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 1,
    total: 1,
  },
  outputTokens: { reasoning: undefined, text: 1, total: 1 },
};

const streamOf = (sql: string) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ id: "t", type: "text-start" });
      controller.enqueue({ delta: sql, id: "t", type: "text-delta" });
      controller.enqueue({ id: "t", type: "text-end" });
      controller.enqueue({
        finishReason: { raw: undefined, unified: "stop" },
        type: "finish",
        usage,
      });
      controller.close();
    },
  });

type MockModel = Extract<LanguageModel, { specificationVersion: "v3" }>;

const scriptedModel = (sql: string): MockModel => ({
  doGenerate: vi.fn().mockRejectedValue(new Error("no card today")),
  doStream: vi.fn().mockResolvedValue({ stream: streamOf(sql) }),
  modelId: "test-model",
  provider: "test",
  specificationVersion: "v3",
  supportedUrls: {},
});

const fakePool = (dialect: Pool["dialect"] = "postgresql") => ({
  dialect,
  execute: vi.fn().mockResolvedValue({
    columns: [{ name: "n", typeName: "INT4" }],
    executionTimeMs: 0,
    isTruncated: false,
    resultType: "tabular",
    rowCount: 1,
    rows: [[42]],
  }),
  listDatabases: vi.fn().mockResolvedValue(["analytics", "public"]),
});

const setup = (
  options: {
    pool?: ReturnType<typeof fakePool>;
    model?: LanguageModel | null;
    connected?: boolean;
  } = {}
) => {
  const pool = options.pool ?? fakePool();
  const pools = {
    connect: vi.fn<ConnectionPoolManager["connect"]>().mockResolvedValue(),
    getPool: vi.fn(() => pool),
    has: vi.fn(() => options.connected ?? true),
  };
  const schemas: SchemaCache = {
    get: vi.fn().mockResolvedValue({ schemas: [] }),
    invalidate: vi.fn(),
  };
  const messages: AskEventMessage[] = [];
  const settled = Promise.withResolvers<void>();
  const rememberAsk = vi.fn<(ask: RecentAsk) => Promise<void>>();
  rememberAsk.mockResolvedValue();
  const loadModel = vi.fn().mockResolvedValue(options.model ?? null);
  const service = createAskService({
    loadModel,
    pools: pools as unknown as ConnectionPoolManager,
    rememberAsk,
    schemas,
    send: (message) => {
      messages.push(message);
      if (message.event.type === "done" || message.event.type === "error") {
        settled.resolve();
      }
    },
  });
  return {
    loadModel,
    messages,
    pool,
    pools,
    rememberAsk,
    schemas,
    service,
    settled: settled.promise,
  };
};

const eventsFor = (messages: AskEventMessage[], askId: string): AskEvent[] =>
  messages
    .filter((message) => message.askId === askId)
    .map((message) => message.event);

const REFINE = {
  chainId: "chain-1",
  spec: {
    formats: {},
    title: "Orders",
    version: CARD_SPEC_VERSION,
    view: { kind: "table" as const },
  },
  sql: "select count(*) as n from orders",
  turns: ["How many orders?"],
};

const ask = (askId: string, prompt = "How many?") => ({
  askId,
  connectionId: connection.id,
  database: null,
  prompt,
});

vi.mocked(getConnections).mockResolvedValue([connection]);

describe("createAskService", () => {
  it("asks for AI settings when none are saved", async () => {
    const { messages, service, settled } = setup();
    service.startAsk(ask("a1"));
    await settled;

    expect(eventsFor(messages, "a1")).toStrictEqual([
      {
        code: "NO_AI_SETTINGS",
        message: "Add an AI provider in Settings to ask questions.",
        phase: "schema",
        type: "error",
      },
    ]);
  });

  it("rejects engines without a SQL dialect", async () => {
    const { messages, service, settled } = setup({ pool: fakePool(null) });
    service.startAsk(ask("a1"));
    await settled;

    expect(eventsFor(messages, "a1")).toMatchObject([
      {
        code: "UNSUPPORTED_ENGINE",
        message: "Asking questions doesn't work with this database yet.",
      },
    ]);
  });

  it("reports a connection that no longer exists", async () => {
    const { messages, service, settled } = setup();
    service.startAsk({ ...ask("a1"), connectionId: "gone" });
    await settled;

    expect(eventsFor(messages, "a1")).toMatchObject([
      { code: "QUERY_FAILED", phase: "schema" },
    ]);
  });

  it("connects the pool when the connection is not live yet", async () => {
    const { pools, service, settled } = setup({ connected: false });
    service.startAsk(ask("a1"));
    await settled;

    expect(pools.connect).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({ database: "oh_my_query", type: "postgresql" })
    );
  });

  it("runs the generated SQL read-only on the resolved schema and records it", async () => {
    const { messages, pool, schemas, service, settled } = setup({
      model: scriptedModel("select 42 as n"),
    });
    service.startAsk(ask("a1"));
    await settled;

    expect(eventsFor(messages, "a1").at(-1)).toStrictEqual({ type: "done" });
    expect(schemas.get).toHaveBeenCalledWith("conn-1", "public");
    expect(pool.execute).toHaveBeenCalledWith(
      "select 42 as n",
      2000,
      "public",
      expect.any(AbortSignal),
      { readOnly: true }
    );
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sql: "select 42 as n", success: true })
    );
  });

  it("remembers an answered ask with its SQL and card", async () => {
    const { rememberAsk, service, settled } = setup({
      model: scriptedModel("select 42 as n"),
    });
    service.startAsk(ask("a1", "How many orders?"));
    await settled;

    expect(rememberAsk).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "conn-1",
        dialect: "postgresql",
        id: "a1",
        prompt: "How many orders?",
        spec: expect.objectContaining({ version: CARD_SPEC_VERSION }),
        sql: "select 42 as n",
      })
    );
  });

  it("still finishes the ask when recents can't be saved", async () => {
    const { messages, rememberAsk, service, settled } = setup({
      model: scriptedModel("select 42 as n"),
    });
    rememberAsk.mockRejectedValue(new Error("disk full"));
    const error = vi.spyOn(console, "error").mockReturnValue();
    service.startAsk(ask("a1"));
    await settled;

    expect(eventsFor(messages, "a1").at(-1)).toStrictEqual({ type: "done" });
    error.mockRestore();
  });

  it("doesn't remember an ask that failed", async () => {
    const { rememberAsk, service, settled } = setup();
    service.startAsk(ask("a1"));
    await settled;
    expect(rememberAsk).not.toHaveBeenCalled();
  });

  it("cancels the previous ask on the same connection", async () => {
    const held = Promise.withResolvers<DatabaseConnection[]>();
    vi.mocked(getConnections).mockReturnValueOnce(held.promise);
    const { messages, service } = setup();

    service.startAsk(ask("first"));
    service.startAsk(ask("second"));
    held.resolve([connection]);
    await vi.waitFor(() => {
      expect(eventsFor(messages, "first")).toHaveLength(1);
    });

    expect(eventsFor(messages, "first")).toMatchObject([{ code: "CANCELLED" }]);
  });

  it("cancels an ask on request", async () => {
    const held = Promise.withResolvers<DatabaseConnection[]>();
    vi.mocked(getConnections).mockReturnValueOnce(held.promise);
    const { messages, service, settled } = setup();

    service.startAsk(ask("a1"));
    service.cancelAsk("a1");
    held.resolve([connection]);
    await settled;

    expect(eventsFor(messages, "a1")).toMatchObject([{ code: "CANCELLED" }]);
  });

  it("rejects malformed requests at the boundary", () => {
    const { service } = setup();
    expect(() => service.startAsk({ ...ask("a1"), prompt: "   " })).toThrow(
      /too_small|at least 1/i
    );
  });

  it.each([
    ["too many turns", { ...REFINE, turns: ["a", "b", "c", "d", "e", "f"] }],
    ["SQL over the cap", { ...REFINE, sql: "x".repeat(20_001) }],
    ["an invalid card", { ...REFINE, spec: { title: "No view" } }],
  ])("rejects a refine with %s", (_label, refine) => {
    const { service } = setup();
    expect(() =>
      service.startAsk({ ...ask("a2", "only Europe"), refine } as AskParams)
    ).toThrow(/too_big|too_small|invalid/i);
  });

  it("sends the refine context to the model and keeps one recent per chain", async () => {
    const model = scriptedModel("select 42 as n");
    const { rememberAsk, service, settled } = setup({ model });
    service.startAsk({ ...ask("a2", "only Europe"), refine: REFINE });
    await settled;

    expect(JSON.stringify(vi.mocked(model.doStream).mock.calls[0])).toContain(
      REFINE.sql
    );
    expect(rememberAsk).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "chain-1",
        prompt: "How many orders? · only Europe",
        sql: "select 42 as n",
      })
    );
  });
});

const rawRun = (askId: string, sql = "select 42 as n") => ({
  askId,
  connectionId: connection.id,
  database: null,
  source: { kind: "sql" as const, sql },
});

describe("raw SQL runs", () => {
  it("runs typed SQL read-only without loading a model", async () => {
    const { loadModel, messages, pool, rememberAsk, service, settled } =
      setup();
    service.startSqlRun(rawRun("r1"));
    await settled;

    expect(loadModel).not.toHaveBeenCalled();
    expect(pool.execute).toHaveBeenCalledWith(
      "select 42 as n",
      2000,
      "public",
      expect.any(AbortSignal),
      { readOnly: true }
    );
    expect(eventsFor(messages, "r1").map((event) => event.type)).toStrictEqual([
      "sqlDone",
      "phase",
      "result",
      "card",
      "done",
    ]);
    expect(rememberAsk).not.toHaveBeenCalled();
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sql: "select 42 as n", success: true })
    );
  });

  it("never sends a refused statement to the database", async () => {
    const { messages, pool, service, settled } = setup();
    service.startSqlRun(rawRun("r1", "update orders set total = 0"));
    await settled;

    expect(pool.execute).not.toHaveBeenCalled();
    expect(eventsFor(messages, "r1").at(-1)).toMatchObject({
      code: "NOT_READ_ONLY",
      phase: "sql",
    });
  });

  it("explains that raw SQL needs a SQL engine", async () => {
    const { messages, service, settled } = setup({ pool: fakePool(null) });
    service.startSqlRun(rawRun("r1"));
    await settled;

    expect(eventsFor(messages, "r1")).toStrictEqual([
      {
        code: "UNSUPPORTED_ENGINE",
        message: "Running SQL works with SQL databases for now.",
        phase: "run",
        type: "error",
      },
    ]);
  });

  it("rejects malformed input at the boundary", () => {
    const { service } = setup();
    expect(() => service.startSqlRun(rawRun("r1", "   "))).toThrow("Too small");
  });

  it("supersedes the previous run on the same connection", async () => {
    const held = Promise.withResolvers<DatabaseConnection[]>();
    vi.mocked(getConnections).mockReturnValueOnce(held.promise);
    const { messages, service } = setup();

    service.startSqlRun(rawRun("first"));
    service.startAsk(ask("second"));
    held.resolve([connection]);
    await vi.waitFor(() => {
      expect(eventsFor(messages, "first")).toHaveLength(1);
    });
    expect(eventsFor(messages, "first")).toMatchObject([{ code: "CANCELLED" }]);
  });

  it("stops a running query on cancelAsk", async () => {
    const pool = fakePool();
    const started = Promise.withResolvers<void>();
    pool.execute.mockImplementation(
      (_sql: string, _max: number, _db: string, signal: AbortSignal) => {
        started.resolve();
        const { promise, reject } = Promise.withResolvers<never>();
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        return promise;
      }
    );
    const { messages, service, settled } = setup({ pool });
    service.startSqlRun(rawRun("r1"));
    await started.promise;
    service.cancelAsk("r1");
    await settled;

    expect(eventsFor(messages, "r1").at(-1)).toMatchObject({
      code: "CANCELLED",
      phase: "run",
    });
  });
});

const USERS_SCHEMA = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          columns: [
            {
              dataType: "character varying",
              defaultValue: null,
              isNullable: true,
              isPrimaryKey: false,
              name: "email",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "users",
          rowEstimate: 10,
        },
      ],
      views: [],
    },
  ],
};

const EMAIL = { kind: "email" as const, value: "ada@example.com" };

const matchRun = (
  askId: string,
  overrides: Partial<{ schema: string; table: string; column: string }> = {}
) => ({
  askId,
  connectionId: connection.id,
  database: null,
  source: {
    column: "email",
    kind: "match" as const,
    schema: "public",
    table: "users",
    value: EMAIL,
    ...overrides,
  },
});

describe("match runs", () => {
  it("opens the matching rows with the value bound, read-only and bounded", async () => {
    const { messages, pool, schemas, service, settled } = setup();
    vi.mocked(schemas.get).mockResolvedValue(USERS_SCHEMA);
    service.startSqlRun(matchRun("m1"));
    await settled;

    const sql = 'SELECT * FROM "public"."users" WHERE "email" = $1 LIMIT 50';
    expect(pool.execute).toHaveBeenCalledWith(
      sql,
      2000,
      "public",
      expect.any(AbortSignal),
      { params: ["ada@example.com"], readOnly: true }
    );
    const events = eventsFor(messages, "m1");
    expect(events[0]).toMatchObject({ sql, type: "sqlDone" });
    expect(events.find((event) => event.type === "card")).toMatchObject({
      spec: { title: "Users · email" },
    });
  });

  it.each([
    ["an unknown table", { table: "people" }],
    ["an unknown column", { column: "mail" }],
    ["another schema", { schema: "audit" }],
  ])("refuses %s without touching the database", async (_label, override) => {
    const { messages, pool, schemas, service, settled } = setup();
    vi.mocked(schemas.get).mockResolvedValue(USERS_SCHEMA);
    service.startSqlRun(matchRun("m1", override));
    await settled;

    expect(pool.execute).not.toHaveBeenCalled();
    expect(eventsFor(messages, "m1")).toStrictEqual([
      {
        code: "QUERY_FAILED",
        message: "This table changed since the search. Search again.",
        phase: "run",
        type: "error",
      },
    ]);
  });

  it("refuses a value whose kind no longer fits the column", async () => {
    const { messages, pool, schemas, service, settled } = setup();
    vi.mocked(schemas.get).mockResolvedValue(USERS_SCHEMA);
    service.startSqlRun({
      ...matchRun("m1"),
      source: {
        ...matchRun("m1").source,
        value: { kind: "integer", value: "42" },
      },
    });
    await settled;
    expect(pool.execute).not.toHaveBeenCalled();
    expect(eventsFor(messages, "m1")).toMatchObject([{ code: "QUERY_FAILED" }]);
  });
});
