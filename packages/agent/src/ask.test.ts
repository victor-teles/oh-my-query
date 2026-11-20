import type { SchemaInfo, TabularResult } from "@conch/core";
import type { AskEvent, RefineContext } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AskPorts } from "./ask.ts";

import { runAsk } from "./ask.ts";
import { mongoEngine } from "./mongo-engine.ts";
import { PRESENT_TIMEOUT_MS } from "./present.ts";
import { redisEngine } from "./redis-engine.ts";
import { sqlEngine } from "./sql-engine.ts";
import { column, largeSchema, table } from "./test-fixtures.ts";

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 10,
    total: 10,
  },
  outputTokens: { reasoning: undefined, text: 10, total: 10 },
};
const finishReason = { raw: undefined, unified: "stop" as const };

type StreamResult = Awaited<
  ReturnType<MockLanguageModelV3["doStream"]>
>["stream"];
type StreamChunk =
  StreamResult extends ReadableStream<infer Part> ? Part : never;
type GenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;

const sqlStream = (deltas: string[], chunkDelayInMs: number | null = null) =>
  simulateReadableStream<StreamChunk>({
    chunkDelayInMs,
    chunks: [
      { id: "t", type: "text-start" },
      ...deltas.map((delta) => ({
        delta,
        id: "t",
        type: "text-delta" as const,
      })),
      { id: "t", type: "text-end" },
      { finishReason, type: "finish", usage },
    ],
  });

const jsonReply = (spec: unknown): GenerateResult => ({
  content: [{ text: JSON.stringify(spec), type: "text" }],
  finishReason,
  usage,
  warnings: [],
});

const hangUntilAborted = (
  signal: AbortSignal | undefined
): Promise<GenerateResult> => {
  const { promise, reject } = Promise.withResolvers<GenerateResult>();
  signal?.addEventListener("abort", () => reject(signal.reason), {
    once: true,
  });
  return promise;
};

type GenerateReply =
  | GenerateResult
  | ((options: { abortSignal?: AbortSignal }) => Promise<GenerateResult>);

const scriptedModel = (
  sqlAttempts: string[][],
  reply: GenerateReply = jsonReply(null)
) => {
  const doStream = vi.fn();
  for (const attempt of sqlAttempts) {
    doStream.mockResolvedValueOnce({ stream: sqlStream(attempt) });
  }
  return new MockLanguageModelV3({ doGenerate: reply, doStream });
};

const MRR_SQL = [
  "-- Monthly recurring revenue by region\n",
  "select month, region, mrr\n",
  "from mrr_by_region order by month",
];

const mrrResult = (): TabularResult => ({
  columns: [
    { name: "month", typeName: "DATE" },
    { name: "region", typeName: "TEXT" },
    { name: "mrr", typeName: "NUMERIC" },
  ],
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 4,
  rows: [
    ["2026-01-01", "Europe", "100"],
    ["2026-01-01", "Asia Pacific", "31"],
    ["2026-02-01", "Europe", "120"],
    ["2026-02-01", "Asia Pacific", "71"],
  ],
});

const singleColumnResult = (
  name: string,
  rows: unknown[][],
  typeName = "TEXT"
): TabularResult => ({
  columns: [{ name, typeName }],
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

const MODEL_SPEC = {
  formats: [{ column: "mrr", currency: "USD", kind: "currency" }],
  insight: "Asia Pacific more than doubled, from 31 to 71.",
  subtitle: "Jan to Feb 2026",
  title: "Monthly recurring revenue by region",
  view: {
    groupBy: "region",
    kind: "chart",
    mark: "line",
    stacked: false,
    x: "month",
    y: ["mrr"],
  },
};

const smallSchema: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        table("mrr_by_region", [], 100, [
          column("month", "date"),
          column("region"),
          column("mrr", "numeric"),
        ]),
      ],
      views: [],
    },
  ],
};

type ExecuteMock = ReturnType<typeof vi.fn<AskPorts["execute"]>>;

const makePorts = (
  model: MockLanguageModelV3,
  overrides: Partial<AskPorts> & { execute?: ExecuteMock } = {}
): AskPorts & { execute: ExecuteMock } => ({
  connectionLabel: "analytics",
  engine: sqlEngine("postgresql"),
  loadSchema: vi.fn<AskPorts["loadSchema"]>().mockResolvedValue(smallSchema),
  model,
  now: () => new Date("2026-11-18T12:00:00Z"),
  redact: { customPatterns: [], enabled: false },
  ...overrides,
  execute:
    overrides.execute ??
    vi.fn<AskPorts["execute"]>().mockResolvedValue(mrrResult()),
});

const never = <T>(): Promise<T> => Promise.withResolvers<T>().promise;

const collect = async (
  prompt: string,
  ports: AskPorts,
  signal = new AbortController().signal,
  onEvent?: (event: AskEvent) => void
): Promise<AskEvent[]> => {
  const events: AskEvent[] = [];
  for await (const event of runAsk(prompt, ports, signal)) {
    events.push(event);
    onEvent?.(event);
  }
  return events;
};

const abortOnFirstDelta =
  (controller: AbortController) =>
  (event: AskEvent): void => {
    if (event.type === "sqlDelta") {
      controller.abort();
    }
  };

const shape = (events: AskEvent[]): string[] =>
  events
    .map((event) =>
      event.type === "phase" ? `phase:${event.phase}` : event.type
    )
    .filter(
      (type, index, all) =>
        !(type === "sqlDelta" && all[index - 1] === "sqlDelta")
    );

const ofType = <T extends AskEvent["type"]>(
  events: AskEvent[],
  type: T
): Extract<AskEvent, { type: T }>[] =>
  events.filter(
    (event): event is Extract<AskEvent, { type: T }> => event.type === type
  );

const sqlText = (events: AskEvent[]): string =>
  ofType(events, "sqlDelta")
    .map((event) => event.text)
    .join("");

const terminals = (events: AskEvent[]): AskEvent[] =>
  events.filter((event, index) => {
    const isTerminal = event.type === "done" || event.type === "error";
    return isTerminal || index === events.length - 1;
  });

const promptText = (prompt: unknown): string => JSON.stringify(prompt);

describe("runAsk", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("streams the happy path in order", async () => {
    const ports = makePorts(scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC)));
    const events = await collect("Revenue by region", ports);

    expect(shape(events)).toStrictEqual([
      "phase:schema",
      "phase:sql",
      "sqlDelta",
      "sqlDone",
      "phase:run",
      "result",
      "phase:present",
      "card",
      "done",
    ]);
    expect(ofType(events, "phase").map((event) => event.detail)).toStrictEqual([
      "Reading the analytics schema",
      "Writing SQL",
      "Read only on analytics",
      "Shaping the result",
    ]);
    expect(sqlText(events)).toBe(MRR_SQL.join(""));
    expect(ports.execute.mock.calls[0]?.[0]).toBe(MRR_SQL.join(""));
  });

  it("reports the finished SQL and the model's card", async () => {
    const ports = makePorts(scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC)));
    const events = await collect("Revenue by region", ports);

    expect(ofType(events, "sqlDone")).toStrictEqual([
      {
        dialect: "postgresql",
        lines: 3,
        sql: MRR_SQL.join(""),
        type: "sqlDone",
      },
    ]);
    expect(ofType(events, "card")[0]).toMatchObject({
      source: "model",
      spec: {
        formats: { mrr: { currency: "USD", kind: "currency" } },
        title: "Monthly recurring revenue by region",
        version: CARD_SPEC_VERSION,
        view: { groupBy: "region", kind: "chart", mark: "line", y: ["mrr"] },
      },
    });
    expect(ofType(events, "result")[0]).toMatchObject({
      isTruncated: false,
      rowCount: 4,
    });
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it("puts the schema, dialect and date in the SQL prompt", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collect("Revenue by region", makePorts(model));
    const prompt = promptText(model.doStreamCalls[0]?.prompt);

    expect(prompt).toContain("read-only PostgreSQL query");
    expect(prompt).toContain("Table: mrr_by_region");
    expect(prompt).toContain("Today is 2026-11-18");
    expect(prompt).toContain("Revenue by region");
  });

  it("strips code fences split across chunks", async () => {
    const model = scriptedModel([["``", "`sql\nselect 1 as n", "\n``", "`\n"]]);
    const events = await collect("one", makePorts(model));

    expect(sqlText(events)).toBe("select 1 as n");
    expect(ofType(events, "sqlDone")[0]).toMatchObject({
      lines: 1,
      sql: "select 1 as n",
    });
  });

  it("stops at the guard without running a mutation", async () => {
    const model = scriptedModel([["-- Remove users\n", "delete from users"]]);
    const ports = makePorts(model);
    const events = await collect("delete all users", ports);

    expect(terminals(events)).toStrictEqual([
      {
        code: "NOT_READ_ONLY",
        message: "Only read-only queries can run here, not DELETE.",
        phase: "sql",
        sql: "-- Remove users\ndelete from users",
        type: "error",
      },
    ]);
    expect(ports.execute).not.toHaveBeenCalled();
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("repairs a failed query on the first attempt", async () => {
    const model = scriptedModel(
      [["select monht from mrr_by_region"], MRR_SQL],
      jsonReply(MODEL_SPEC)
    );
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockRejectedValueOnce(new Error('column "monht" does not exist'))
      .mockResolvedValueOnce(mrrResult());
    const events = await collect(
      "Revenue by region",
      makePorts(model, { execute })
    );

    expect(shape(events)).toStrictEqual([
      "phase:schema",
      "phase:sql",
      "sqlDelta",
      "sqlDone",
      "phase:run",
      "sqlReset",
      "phase:sql",
      "sqlDelta",
      "sqlDone",
      "phase:run",
      "result",
      "phase:present",
      "card",
      "done",
    ]);
    expect(ofType(events, "sqlReset")).toStrictEqual([
      { reason: 'column "monht" does not exist', type: "sqlReset" },
    ]);
    expect(promptText(model.doStreamCalls[1]?.prompt)).toContain(
      "select monht from mrr_by_region"
    );
  });

  it("gives up with QUERY_FAILED after two failed repairs", async () => {
    const model = scriptedModel([["select a"], ["select b"], ["select c"]]);
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockRejectedValue(new Error("relation does not exist"));
    const events = await collect("q", makePorts(model, { execute }));

    expect(ofType(events, "sqlReset")).toHaveLength(2);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(terminals(events)).toStrictEqual([
      {
        code: "QUERY_FAILED",
        message: "relation does not exist",
        phase: "run",
        sql: "select c",
        type: "error",
      },
    ]);
  });

  it("cancels mid-SQL without running anything", async () => {
    const model = new MockLanguageModelV3({
      doStream: { stream: sqlStream(["select ", "1 ", "as n"], 20) },
    });
    const ports = makePorts(model);
    const controller = new AbortController();
    const events = await collect(
      "q",
      ports,
      controller.signal,
      abortOnFirstDelta(controller)
    );

    expect(terminals(events)).toStrictEqual([
      {
        code: "CANCELLED",
        message: "The question was cancelled.",
        phase: "sql",
        type: "error",
      },
    ]);
    expect(ofType(events, "sqlDone")).toHaveLength(0);
    expect(ports.execute).not.toHaveBeenCalled();
  });

  it("cancels a running query", async () => {
    const controller = new AbortController();
    const execute = vi.fn<AskPorts["execute"]>(() => {
      controller.abort();
      return never<TabularResult>();
    });
    const events = await collect(
      "q",
      makePorts(scriptedModel([MRR_SQL]), { execute }),
      controller.signal
    );

    expect(terminals(events)).toMatchObject([
      { code: "CANCELLED", phase: "run" },
    ]);
  });

  it("times out a slow query after 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const execute = vi.fn<AskPorts["execute"]>(() => never<TabularResult>());
    const pending = collect(
      "q",
      makePorts(scriptedModel([MRR_SQL]), { execute })
    );
    await vi.advanceTimersByTimeAsync(30_001);

    expect(terminals(await pending)).toMatchObject([
      { code: "TIMEOUT", phase: "run" },
    ]);
    expect(execute.mock.calls[0]?.[1].aborted).toBeTruthy();
  });

  it("falls back to an inferred card when the model's spec does not fit the result", async () => {
    const model = scriptedModel(
      [MRR_SQL],
      jsonReply({ ...MODEL_SPEC, view: { ...MODEL_SPEC.view, y: ["arr"] } })
    );
    const events = await collect("Revenue by region", makePorts(model));

    expect(ofType(events, "card")[0]).toMatchObject({
      source: "inferred",
      spec: {
        title: "Monthly recurring revenue by region",
        view: { groupBy: "region", mark: "line", x: "month", y: ["mrr"] },
      },
    });
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it("asks for the card with a schema strict providers accept", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collect("Revenue by region", makePorts(model));
    const format = JSON.stringify(model.doGenerateCalls[0]?.responseFormat);

    expect(format).toContain('"anyOf"');
    expect(format).not.toContain('"oneOf"');
  });

  it("keeps the model's card when groupBy only repeats the x column", async () => {
    const model = scriptedModel(
      [MRR_SQL],
      jsonReply({
        ...MODEL_SPEC,
        view: { ...MODEL_SPEC.view, groupBy: "month" },
      })
    );
    const events = await collect("Revenue by region", makePorts(model));

    expect(ofType(events, "card")[0]).toMatchObject({
      source: "model",
      spec: { insight: MODEL_SPEC.insight, view: { x: "month", y: ["mrr"] } },
    });
    expect(ofType(events, "card")[0]?.spec.view).not.toHaveProperty("groupBy");
  });

  it("drops a currency format the model puts on a cents column", async () => {
    const model = scriptedModel(
      [["select status, sum(total_cents) as revenue_cents from orders"]],
      jsonReply({
        formats: [
          { column: "revenue_cents", currency: "USD", kind: "currency" },
        ],
        insight: null,
        subtitle: null,
        title: "Revenue by status",
        view: { columns: null, kind: "table" },
      })
    );
    const execute = vi.fn<AskPorts["execute"]>().mockResolvedValue({
      columns: [
        { name: "status", typeName: "TEXT" },
        { name: "revenue_cents", typeName: "INT8" },
      ],
      executionTimeMs: 1,
      isTruncated: false,
      resultType: "tabular",
      rowCount: 1,
      rows: [["paid", "13999"]],
    });
    const events = await collect("q", makePorts(model, { execute }));

    expect(ofType(events, "card")[0]).toMatchObject({
      source: "model",
      spec: { formats: {}, title: "Revenue by status" },
    });
  });

  it("falls back to an inferred card when the model's reply is not a card", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply({ nonsense: true }));
    const events = await collect("Revenue by region", makePorts(model));

    expect(ofType(events, "card")[0]).toMatchObject({ source: "inferred" });
  });

  it("falls back to an inferred card when presenting takes longer than 8s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const model = scriptedModel([MRR_SQL], (options) =>
      hangUntilAborted(options.abortSignal)
    );
    const pending = collect("Revenue by region", makePorts(model));
    await vi.advanceTimersByTimeAsync(PRESENT_TIMEOUT_MS + 10);
    const events = await pending;

    expect(ofType(events, "card")[0]).toMatchObject({ source: "inferred" });
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it("redacts PII in the sample rows sent to the model", async () => {
    const model = scriptedModel([["select email from customers"]]);
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockResolvedValue(
        singleColumnResult("email", [
          ["ada@example.com"],
          ["grace@example.com"],
        ])
      );
    await collect(
      "customers",
      makePorts(model, {
        execute,
        redact: { customPatterns: [], enabled: true },
      })
    );
    const prompt = promptText(model.doGenerateCalls[0]?.prompt);

    expect(prompt).not.toContain("ada@example.com");
    expect(prompt).toContain("[REDACTED]");
  });

  it("sends at most 20 sample rows to the model", async () => {
    const model = scriptedModel([["select n from t"]]);
    const rows = Array.from({ length: 50 }, (_, i) => [`row-${i}`]);
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockResolvedValue(singleColumnResult("n", rows));
    await collect("q", makePorts(model, { execute }));
    const prompt = promptText(model.doGenerateCalls[0]?.prompt);

    expect(prompt).toContain("row-19");
    expect(prompt).not.toContain("row-20");
  });

  it("pre-filters a 300-table schema before prompting", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collect(
      "Monthly revenue by region",
      makePorts(model, {
        loadSchema: vi
          .fn<AskPorts["loadSchema"]>()
          .mockResolvedValue(largeSchema(300)),
      })
    );
    const prompt = promptText(model.doStreamCalls[0]?.prompt);

    expect(prompt).toContain("Table: revenue_events");
    expect(prompt).toContain("Table: regions");
    expect(prompt).toMatch(/\d+ more tables were omitted/);
    expect(prompt.match(/Table: /g)?.length).toBeLessThanOrEqual(80);
  });

  it("maps AI provider failures to AI error codes", async () => {
    const model = new MockLanguageModelV3({
      doStream: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Unauthorized"), { status: 401 })
        ),
    });
    const events = await collect("q", makePorts(model));

    expect(terminals(events)).toStrictEqual([
      {
        code: "AI_AUTH",
        message:
          "Invalid API key or unauthorized access. Check your API key in AI settings.",
        phase: "sql",
        type: "error",
      },
    ]);
  });

  it("reports a schema load failure in the schema phase", async () => {
    const events = await collect(
      "q",
      makePorts(scriptedModel([MRR_SQL]), {
        loadSchema: vi
          .fn<AskPorts["loadSchema"]>()
          .mockRejectedValue(new Error("connection refused")),
      })
    );

    expect(terminals(events)).toStrictEqual([
      {
        code: "QUERY_FAILED",
        message: "connection refused",
        phase: "schema",
        type: "error",
      },
    ]);
  });
});

const REFINE: RefineContext = {
  chainId: "ask-1",
  spec: {
    formats: {},
    title: "Monthly recurring revenue by region",
    version: CARD_SPEC_VERSION,
    view: {
      groupBy: "region",
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    },
  },
  sql: "select month, region, mrr from mrr_by_region order by month",
  turns: ["Revenue by region"],
};

const roles = (prompt: unknown): string[] =>
  Array.isArray(prompt)
    ? prompt.map((message: { role: string }) => message.role)
    : [];

const collectRefine = async (prompt: string, ports: AskPorts) => {
  const events: AskEvent[] = [];
  for await (const event of runAsk(
    prompt,
    ports,
    new AbortController().signal,
    REFINE
  )) {
    events.push(event);
  }
  return events;
};

describe("runAsk with a refine", () => {
  it("sends the earlier turn, its SQL and the follow-up in order", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collectRefine("only Europe", makePorts(model));
    const prompt = model.doStreamCalls[0]?.prompt;
    const text = promptText(prompt);

    expect(roles(prompt)).toStrictEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(text).toContain("Revenue by region");
    expect(text).toContain(REFINE.sql);
    expect(text).toContain("follow-up: only Europe");
    expect(text).toContain('a line chart titled \\"Monthly recurring');
  });

  it("emits the same event sequence as a fresh ask", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    const events = await collectRefine("only Europe", makePorts(model));

    expect(shape(events)).toStrictEqual([
      "phase:schema",
      "phase:sql",
      "sqlDelta",
      "sqlDone",
      "phase:run",
      "result",
      "phase:present",
      "card",
      "done",
    ]);
  });

  it("keeps tables named only in the previous SQL in the schema excerpt", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    const ports = makePorts(model, {
      loadSchema: vi
        .fn<AskPorts["loadSchema"]>()
        .mockResolvedValue(largeSchema(300, [table("churn_snapshots")])),
    });
    const events: AskEvent[] = [];
    for await (const event of runAsk(
      "only Europe",
      ports,
      new AbortController().signal,
      {
        ...REFINE,
        sql: "select * from churn_snapshots",
      }
    )) {
      events.push(event);
    }

    expect(promptText(model.doStreamCalls[0]?.prompt)).toContain(
      "Table: churn_snapshots"
    );
  });

  it("still rejects a write the model returns for a follow-up", async () => {
    const model = scriptedModel([["delete from mrr_by_region"]]);
    const ports = makePorts(model);
    const events = await collectRefine("remove Europe", ports);

    expect(terminals(events)).toStrictEqual([
      expect.objectContaining({ code: "NOT_READ_ONLY", type: "error" }),
    ]);
    expect(ports.execute).not.toHaveBeenCalled();
  });

  it("keeps the refine context when repairing a failed query", async () => {
    const model = scriptedModel(
      [["select monht from mrr_by_region"], MRR_SQL],
      jsonReply(MODEL_SPEC)
    );
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockRejectedValueOnce(new Error('column "monht" does not exist'))
      .mockResolvedValue(mrrResult());
    await collectRefine("only Europe", makePorts(model, { execute }));
    const repair = model.doStreamCalls[1]?.prompt;

    expect(roles(repair)).toStrictEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(promptText(repair)).toContain(REFINE.sql);
    expect(promptText(repair)).toContain("monht");
  });

  it("gives the card step the chain prompt and the previous card", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collectRefine("only Europe", makePorts(model));
    const prompt = promptText(model.doGenerateCalls[0]?.prompt);

    expect(prompt).toContain("Revenue by region · only Europe");
    expect(prompt).toContain('\\"previousCard\\"');
    expect(prompt).toContain("keep its view and formats");
  });

  it("sends only the question when there is no refine", async () => {
    const model = scriptedModel([MRR_SQL], jsonReply(MODEL_SPEC));
    await collect("Revenue by region", makePorts(model));

    expect(roles(model.doStreamCalls[0]?.prompt)).toStrictEqual([
      "system",
      "user",
    ]);
    expect(promptText(model.doGenerateCalls[0]?.prompt)).not.toContain(
      '\\"previousCard\\"'
    );
  });
});

const ORDERS_PIPELINE = JSON.stringify({
  collection: "orders",
  description: "Orders by status",
  pipeline: [
    { $group: { _id: "$status", orders: { $sum: 1 } } },
    { $project: { _id: 0, orders: 1, status: "$_id" } },
  ],
});

const ordersResult = (): TabularResult => ({
  columns: [
    { name: "orders", typeName: "NUMERIC" },
    { name: "status", typeName: "TEXT" },
  ],
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 2,
  rows: [
    [12, "paid"],
    [3, "refunded"],
  ],
});

const mongoSchema: SchemaInfo = {
  schemas: [
    {
      name: "shop",
      tables: [
        table("orders", [], 12_400, [
          column("_id", "objectId"),
          column("status", "string"),
          column("total", "number"),
        ]),
      ],
      views: [],
    },
  ],
};

const redisSchema: SchemaInfo = {
  schemas: [
    {
      name: "0",
      tables: [
        table("session:*", [], 3400, [column("user_id"), column("ip")]),
        table("leaderboard", [], 1, [column("value", "zset")]),
      ],
      views: [],
    },
  ],
};

const halves = (text: string): string[] => [
  text.slice(0, Math.floor(text.length / 2)),
  text.slice(Math.floor(text.length / 2)),
];

describe("runAsk on MongoDB", () => {
  const mongoPorts = (
    model: MockLanguageModelV3,
    overrides: Partial<AskPorts> & { execute?: ExecuteMock } = {}
  ) =>
    makePorts(model, {
      engine: mongoEngine,
      execute: vi.fn<AskPorts["execute"]>().mockResolvedValue(ordersResult()),
      loadSchema: vi
        .fn<AskPorts["loadSchema"]>()
        .mockResolvedValue(mongoSchema),
      ...overrides,
    });

  it("streams a pipeline, guards it, runs it and presents a card", async () => {
    const model = scriptedModel([halves(ORDERS_PIPELINE)]);
    const ports = mongoPorts(model);
    const events = await collect("orders by status", ports);

    expect(sqlText(events)).toBe(ORDERS_PIPELINE);
    expect(ofType(events, "sqlDone")[0]).toMatchObject({
      dialect: "mongodb",
      sql: ORDERS_PIPELINE,
    });
    expect(ofType(events, "phase").map((event) => event.detail)).toStrictEqual([
      "Reading the analytics schema",
      "Writing the pipeline",
      "Read only on analytics",
      "Shaping the result",
    ]);
    expect(ports.execute.mock.calls[0]?.[0]).toBe(ORDERS_PIPELINE);
    expect(shape(events).slice(-2)).toStrictEqual(["card", "done"]);
  });

  it("shows the sampled collections and tells the card step it read a pipeline", async () => {
    const model = scriptedModel([[ORDERS_PIPELINE]]);
    await collect("orders by status", mongoPorts(model));
    const prompt = promptText(model.doStreamCalls[0]?.prompt);

    expect(prompt).toContain("read-only MongoDB aggregation");
    expect(prompt).toContain(
      "orders (≈12,400 docs): _id objectId, status string, total number"
    );
    expect(promptText(model.doGenerateCalls[0]?.prompt)).toContain(
      String.raw`\"language\": \"mongodb\"`
    );
  });

  it("refuses $merge with the pipeline attached and never runs it", async () => {
    const write = JSON.stringify({
      collection: "orders",
      pipeline: [{ $match: {} }, { $merge: { into: "orders_copy" } }],
    });
    const ports = mongoPorts(scriptedModel([[write]]));
    const events = await collect("copy every order", ports);

    expect(terminals(events)).toStrictEqual([
      {
        code: "NOT_READ_ONLY",
        message: "$merge writes data; only read-only pipelines can run here.",
        phase: "sql",
        sql: write,
        type: "error",
      },
    ]);
    expect(ports.execute).not.toHaveBeenCalled();
  });

  it("repairs a failed pipeline with the MongoDB repair instruction", async () => {
    const model = scriptedModel([[ORDERS_PIPELINE], [ORDERS_PIPELINE]]);
    const execute = vi
      .fn<AskPorts["execute"]>()
      .mockRejectedValueOnce(new Error("unknown group operator '$summ'"))
      .mockResolvedValue(ordersResult());
    const events = await collect(
      "orders by status",
      mongoPorts(model, { execute })
    );

    expect(shape(events)).toContain("sqlReset");
    const repair = promptText(model.doStreamCalls[1]?.prompt);
    expect(repair).toContain("That pipeline failed with this error");
    expect(repair).toContain("$summ");
    expect(repair).toContain("reply with JSON only.");
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it("refines a MongoDB answer with the previous pipeline", async () => {
    const model = scriptedModel([[ORDERS_PIPELINE]]);
    const events: AskEvent[] = [];
    for await (const event of runAsk(
      "only this year",
      mongoPorts(model),
      new AbortController().signal,
      { ...REFINE, sql: ORDERS_PIPELINE, turns: ["orders by status"] }
    )) {
      events.push(event);
    }
    const text = promptText(model.doStreamCalls[0]?.prompt);

    expect(text).toContain("Change that pipeline");
    expect(text).toContain("reply with JSON only.");
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });
});

describe("runAsk on Redis", () => {
  const redisPorts = (model: MockLanguageModelV3, result: TabularResult) =>
    makePorts(model, {
      engine: redisEngine,
      execute: vi.fn<AskPorts["execute"]>().mockResolvedValue(result),
      loadSchema: vi
        .fn<AskPorts["loadSchema"]>()
        .mockResolvedValue(redisSchema),
    });

  it("runs a scan plan", async () => {
    const plan = JSON.stringify({
      groupBy: "pattern",
      kind: "scan",
      limit: 20,
      match: "*",
      measure: "count",
    });
    const ports = redisPorts(
      scriptedModel([[plan]]),
      singleColumnResult("keys", [[3400]], "NUMERIC")
    );
    const events = await collect("keys by pattern", ports);

    expect(ofType(events, "sqlDone")[0]).toMatchObject({ dialect: "redis" });
    expect(ports.execute.mock.calls[0]?.[0]).toBe(plan);
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it("runs a commands plan and shows the key patterns to the model", async () => {
    const plan = JSON.stringify({
      commands: [["ZREVRANGE", "leaderboard", "0", "9", "WITHSCORES"]],
      kind: "commands",
    });
    const model = scriptedModel([[plan]]);
    const ports = redisPorts(
      model,
      singleColumnResult("member", [["alice"], ["bob"]])
    );
    const events = await collect("top 10 on the leaderboard", ports);
    const prompt = promptText(model.doStreamCalls[0]?.prompt);

    expect(prompt).toContain("read-only Redis plan");
    expect(prompt).toContain("session:* (hash, ≈3,400 keys): user_id, ip");
    expect(prompt).toContain("leaderboard (zset, ≈1 key)");
    expect(ofType(events, "phase")[1]?.detail).toBe("Writing the commands");
    expect(terminals(events)).toStrictEqual([{ type: "done" }]);
  });

  it.each([
    ["SET", ["SET", "k", "v"]],
    ["DEL", ["DEL", "k"]],
    ["EVAL", ["EVAL", "return 1", "0"]],
    ["KEYS", ["KEYS", "*"]],
    ["CONFIG", ["CONFIG", "SET", "maxmemory", "1"]],
  ])("refuses %s before any execute", async (name, command) => {
    const plan = JSON.stringify({ commands: [command], kind: "commands" });
    const ports = redisPorts(scriptedModel([[plan]]), ordersResult());
    const events = await collect("do it", ports);

    expect(terminals(events)).toStrictEqual([
      expect.objectContaining({
        code: "NOT_READ_ONLY",
        message: expect.stringMatching(new RegExp(`^${name} `)),
        sql: plan,
        type: "error",
      }),
    ]);
    expect(ports.execute).not.toHaveBeenCalled();
  });
});
