import type { LanguageModel } from "@conch/agent";
import type { DatabaseConnection } from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type { RecentAsk, Widget, WidgetDraft } from "@conch/rpc";

import { getConnections } from "@conch/core";
import { describe, expect, it, vi } from "vitest";

import type { RecentAskStore, WidgetStore } from "./widget-service.ts";

import { createWidgetService } from "./widget-service.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
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

vi.mocked(getConnections).mockResolvedValue([connection]);

const NOW = new Date(2026, 10, 18, 9, 0);

const TEMPLATE = `select region, sum(mrr) as mrr from revenue
where billed_at >= {{period.from}}::date and billed_at < {{period.to}}::date
  and region = {{region}}
group by 1`;

const widgetFixture = (overrides: Partial<Widget> = {}): Widget => ({
  connectionId: "conn-1",
  createdAt: "2026-11-01T00:00:00.000Z",
  database: null,
  dialect: "postgresql",
  id: "w1",
  lastRunAt: null,
  lastValues: {},
  name: "Revenue by region",
  params: [
    {
      default: "lastQuarter",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
    {
      default: "Europe",
      label: "Region",
      name: "region",
      optionsSql: "select distinct region from revenue order by 1",
      type: "select",
    },
  ],
  prompt: "revenue by region",
  spec: { formats: {}, title: "Revenue", version: 1, view: { kind: "table" } },
  sqlTemplate: TEMPLATE,
  updatedAt: "2026-11-01T00:00:00.000Z",
  view: "table",
  ...overrides,
});

const memoryWidgets = (initial: Widget[] = []): WidgetStore => {
  let items = [...initial];
  return {
    deleteWidget: (id) => {
      items = items.filter((item) => item.id !== id);
      return Promise.resolve();
    },
    getWidget: (id) => {
      const found = items.find((item) => item.id === id) ?? null;
      return Promise.resolve(found);
    },
    listWidgets: () => {
      const all = [...items];
      return Promise.resolve(all);
    },
    saveWidget: (widget) => {
      items = [...items.filter((item) => item.id !== widget.id), widget];
      return Promise.resolve(widget);
    },
    updateWidget: (id, change) => {
      const current = items.find((item) => item.id === id);
      if (!current) {
        return Promise.resolve(null);
      }
      const next = change(current);
      items = items.map((item) => (item.id === id ? next : item));
      return Promise.resolve(next);
    },
  };
};

const memoryRecents = (): RecentAskStore & { items: RecentAsk[] } => {
  const items: RecentAsk[] = [];
  return {
    clearRecentAsks: () => {
      items.length = 0;
      return Promise.resolve();
    },
    items,
    listRecentAsks: (limit) => {
      const newest = items.slice(0, limit);
      return Promise.resolve(newest);
    },
    pushRecentAsk: (ask) => {
      items.unshift(ask);
      return Promise.resolve();
    },
    removeRecentAsk: (id) => {
      const index = items.findIndex((item) => item.id === id);
      items.splice(index, 1);
      return Promise.resolve();
    },
  };
};

const tabular = (rows: unknown[][]) => ({
  columns: [{ name: "region", typeName: "TEXT" }],
  executionTimeMs: 3,
  isTruncated: false,
  resultType: "tabular" as const,
  rowCount: rows.length,
  rows,
});

type ExecuteArgs = [
  sql: string,
  maxRows: number,
  schema: string,
  signal: AbortSignal,
  options?: unknown,
];

const fakePool = (dialect: "postgresql" | null = "postgresql") => ({
  dialect,
  execute: vi.fn((...[sql]: ExecuteArgs) => {
    const rows = sql.includes("distinct")
      ? [["Europe"], ["North America"], [null]]
      : [["Europe", 1]];
    return Promise.resolve(tabular(rows));
  }),
  listDatabases: vi.fn().mockResolvedValue(["public"]),
});

const recentAsk = (id: string): RecentAsk => ({
  askedAt: NOW.toISOString(),
  connectionId: "conn-1",
  database: null,
  dialect: "postgresql",
  id,
  prompt: `question ${id}`,
  spec: widgetFixture().spec,
  sql: "select 1",
});

const setup = (
  options: {
    widgets?: Widget[];
    pool?: ReturnType<typeof fakePool>;
    model?: LanguageModel | null;
  } = {}
) => {
  const pool = options.pool ?? fakePool();
  const pools = {
    connect: vi.fn<ConnectionPoolManager["connect"]>().mockResolvedValue(),
    getPool: vi.fn(() => pool),
    has: vi.fn(() => true),
  };
  const widgets = memoryWidgets(options.widgets ?? [widgetFixture()]);
  const recents = memoryRecents();
  const loadModel = vi.fn().mockResolvedValue(options.model ?? null);
  const service = createWidgetService({
    loadModel,
    now: () => NOW,
    pools: pools as unknown as ConnectionPoolManager,
    recents,
    widgets,
  });
  return { loadModel, pool, recents, service, widgets };
};

const run = (values: Record<string, unknown> = {}) => ({
  runId: "r1",
  values: values as never,
  widgetId: "w1",
});

describe("runWidget", () => {
  it("binds values as parameters and runs read-only without the model", async () => {
    const { loadModel, pool, service } = setup();
    const outcome = await service.runWidget(run({ region: "North America" }));

    const call = pool.execute.mock.calls.find(
      ([sql]) => !sql.includes("distinct")
    );
    expect(call?.slice(0, 2)).toStrictEqual([
      expect.stringMatching(
        /billed_at >= \$1::date and billed_at < \$2::date[\s\S]*region = \$3/
      ),
      2000,
    ]);
    expect(call?.[4]).toStrictEqual({
      params: ["2026-07-01", "2026-10-01", "North America"],
      readOnly: true,
    });
    expect(outcome.compiledSql).not.toContain("North America");
    expect(outcome.values).toStrictEqual({
      period: "lastQuarter",
      region: "North America",
    });
    expect(loadModel).not.toHaveBeenCalled();
  });

  it("falls back to last values, then to defaults", async () => {
    const { pool, service } = setup({
      widgets: [widgetFixture({ lastValues: { period: "ytd" } })],
    });
    const outcome = await service.runWidget(run());
    expect(outcome.values).toStrictEqual({ period: "ytd", region: "Europe" });
    expect(pool.execute.mock.calls.at(-1)?.[4]).toMatchObject({
      params: ["2026-01-01", "2026-11-19", "Europe"],
    });
  });

  it("stores the values and run time after a run", async () => {
    const { service, widgets } = setup();
    await service.runWidget(run({ period: "last7d" }));
    const stored = await widgets.getWidget("w1");
    expect(stored?.lastValues).toStrictEqual({
      period: "last7d",
      region: "Europe",
    });
    expect(stored?.lastRunAt).toBe(NOW.toISOString());
  });

  it("refuses a select value that isn't one of the loaded options", async () => {
    const { service } = setup();
    await expect(
      service.runWidget(run({ region: "x'; drop table revenue; --" }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses an input the widget doesn't declare", async () => {
    const { service } = setup();
    await expect(service.runWidget(run({ extra: "1" }))).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Unknown input: extra.",
    });
  });

  it("binds a fixed input's default and refuses a value for it", async () => {
    const fixed = widgetFixture({
      params: [
        {
          default: "lastQuarter",
          label: "Period",
          name: "period",
          type: "dateRange",
        },
        {
          default: "Europe",
          fixed: true,
          label: "Region",
          name: "region",
          options: ["Europe", "North America"],
          type: "select",
        },
      ],
    });
    const { pool, service } = setup({ widgets: [fixed] });
    await expect(
      service.runWidget(run({ region: "North America" }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await service.runWidget(run());
    expect(pool.execute.mock.calls.at(-1)?.[4]).toMatchObject({
      params: ["2026-07-01", "2026-10-01", "Europe"],
    });
  });

  it("refuses a malformed custom range", async () => {
    const { service } = setup();
    await expect(
      service.runWidget(
        run({ period: { from: "2026-10-01", to: "2026-07-01" } })
      )
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses a template that writes", async () => {
    const { pool, service } = setup({
      widgets: [
        widgetFixture({
          params: [],
          sqlTemplate: "delete from revenue",
        }),
      ],
    });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "NOT_READ_ONLY",
    });
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("reports a widget whose connection is gone", async () => {
    const { service } = setup({
      widgets: [widgetFixture({ connectionId: "gone" })],
    });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "CONNECTION_MISSING",
    });
  });

  it("reports a missing widget", async () => {
    const { service } = setup({ widgets: [] });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "WIDGET_NOT_FOUND",
    });
  });

  it("refuses engines without SQL", async () => {
    const { service } = setup({ pool: fakePool(null) });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "UNSUPPORTED_ENGINE",
    });
  });

  it("cancels a run by id", async () => {
    const pool = fakePool();
    pool.execute.mockImplementation((...args: ExecuteArgs) => {
      const { promise, reject } = Promise.withResolvers<never>();
      const { 3: signal } = args;
      signal.addEventListener("abort", () => reject(signal.reason));
      return promise;
    });
    const { service } = setup({
      pool,
      widgets: [widgetFixture({ params: [], sqlTemplate: "select 1" })],
    });
    const pending = service.runWidget(run());
    await vi.waitFor(() => expect(pool.execute).toHaveBeenCalledOnce());
    service.cancelRun("r1");
    await expect(pending).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
  });
});

describe("loadParamOptions", () => {
  it("runs the options query read-only and returns distinct strings", async () => {
    const { pool, service } = setup();
    await expect(
      service.loadParamOptions("w1", "region")
    ).resolves.toStrictEqual(["Europe", "North America"]);
    expect(pool.execute).toHaveBeenCalledWith(
      "select distinct region from revenue order by 1",
      200,
      "public",
      expect.any(AbortSignal),
      { params: undefined, readOnly: true }
    );
  });

  it("caches options for a minute", async () => {
    const { pool, service } = setup();
    await service.loadParamOptions("w1", "region");
    await service.loadParamOptions("w1", "region");
    expect(pool.execute).toHaveBeenCalledOnce();
  });

  it("returns static options without a query", async () => {
    const { pool, service } = setup({
      widgets: [
        widgetFixture({
          params: [
            {
              default: "EU",
              label: "Region",
              name: "region",
              options: ["EU", "US"],
              type: "select",
            },
          ],
          sqlTemplate: "select * from t where r = {{region}}",
        }),
      ],
    });
    await expect(
      service.loadParamOptions("w1", "region")
    ).resolves.toStrictEqual(["EU", "US"]);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("rejects an input without options", async () => {
    const { service } = setup();
    await expect(
      service.loadParamOptions("w1", "period")
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

const draft = (overrides: Partial<WidgetDraft> = {}): WidgetDraft => {
  const {
    createdAt: _c,
    id: _i,
    lastRunAt: _l,
    updatedAt: _u,
    ...rest
  } = widgetFixture();
  return { ...rest, ...overrides };
};

describe("saveWidget", () => {
  it("creates a widget with fresh timestamps and an id", async () => {
    const { service, widgets } = setup({ widgets: [] });
    const saved = await service.saveWidget(draft());
    expect(saved.id).toMatch(/^[\da-f-]{36}$/);
    expect(saved.createdAt).toBe(NOW.toISOString());
    expect(saved.lastRunAt).toBeNull();
    await expect(widgets.listWidgets()).resolves.toHaveLength(1);
  });

  it("keeps createdAt and lastRunAt when updating", async () => {
    const { service } = setup({
      widgets: [widgetFixture({ lastRunAt: "2026-11-10T00:00:00.000Z" })],
    });
    const saved = await service.saveWidget(draft({ id: "w1", name: "MRR" }));
    expect(saved).toMatchObject({
      createdAt: "2026-11-01T00:00:00.000Z",
      lastRunAt: "2026-11-10T00:00:00.000Z",
      name: "MRR",
    });
  });

  it("drops last values for inputs that were removed or no longer fit", async () => {
    const { service } = setup({ widgets: [] });
    const saved = await service.saveWidget(
      draft({
        lastValues: { gone: 1, period: "ytd", region: 7 },
      })
    );
    expect(saved.lastValues).toStrictEqual({ period: "ytd" });
  });

  it("refuses a template that doesn't compile with its inputs", async () => {
    const { service } = setup({ widgets: [] });
    await expect(
      service.saveWidget(draft({ params: [] }))
    ).rejects.toMatchObject({ code: "INVALID_TEMPLATE" });
  });

  it("refuses a template that writes", async () => {
    const { service } = setup({ widgets: [] });
    await expect(
      service.saveWidget(
        draft({ params: [], sqlTemplate: "drop table revenue" })
      )
    ).rejects.toMatchObject({ code: "NOT_READ_ONLY" });
  });
});

describe("listing and recents", () => {
  it("lists the most recently run widgets first", async () => {
    const { service } = setup({
      widgets: [
        widgetFixture({ id: "old", lastRunAt: null }),
        widgetFixture({ id: "ran", lastRunAt: "2026-11-17T00:00:00.000Z" }),
      ],
    });
    const widgets = await service.listWidgets();
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toStrictEqual(["ran", "old"]);
  });

  it("deletes a widget", async () => {
    const { service } = setup();
    await service.deleteWidget("w1");
    await expect(service.listWidgets()).resolves.toStrictEqual([]);
  });

  it("remembers asks for the root list", async () => {
    const { service } = setup();
    const ask: RecentAsk = {
      askedAt: NOW.toISOString(),
      connectionId: "conn-1",
      database: null,
      dialect: "postgresql",
      id: "a1",
      prompt: "mrr",
      spec: widgetFixture().spec,
      sql: "select 1",
    };
    await service.rememberAsk(ask);
    await expect(service.listRecentAsks()).resolves.toStrictEqual([ask]);
  });

  it("lists the newest recent asks up to a limit", async () => {
    const { service } = setup();
    await service.rememberAsk(recentAsk("a1"));
    await service.rememberAsk(recentAsk("a2"));
    const ids = async (limit?: number) => {
      const asks = await service.listRecentAsks({ limit });
      return asks.map((ask) => ask.id);
    };
    await expect(ids(1)).resolves.toStrictEqual(["a2"]);
    await expect(ids()).resolves.toStrictEqual(["a2", "a1"]);
  });

  it.each([
    [0, "Too small"],
    [501, "Too big"],
    [1.5, "expected int"],
  ])("rejects a recent-ask limit of %s", async (limit, message) => {
    const { service } = setup();
    await expect(service.listRecentAsks({ limit })).rejects.toThrow(message);
  });

  it("removes one recent ask and clears them all", async () => {
    const { service } = setup();
    await service.rememberAsk(recentAsk("a1"));
    await service.rememberAsk(recentAsk("a2"));
    await service.deleteRecentAsk("a1");
    await expect(service.listRecentAsks()).resolves.toStrictEqual([
      recentAsk("a2"),
    ]);
    await service.clearRecentAsks();
    await expect(service.listRecentAsks()).resolves.toStrictEqual([]);
  });

  it("rejects an empty ask id", async () => {
    const { service } = setup();
    await expect(service.deleteRecentAsk("")).rejects.toThrow("Too small");
  });
});

describe("proposeParams", () => {
  it("asks for AI settings when there is no model", async () => {
    const { service } = setup();
    await expect(
      service.proposeParams({
        dialect: "postgresql",
        prompt: "q",
        sql: "select 1",
      })
    ).resolves.toStrictEqual({
      error: "Add an AI provider in Settings to find inputs.",
    });
  });

  it("validates the request", async () => {
    const { service } = setup();
    await expect(
      service.proposeParams({ dialect: "postgresql", prompt: "q", sql: " " })
    ).rejects.toThrow(/too_small|at least 1/i);
  });
});
