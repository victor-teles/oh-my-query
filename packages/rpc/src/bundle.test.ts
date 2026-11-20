import { describe, expect, it } from "vitest";

import type { Board } from "./board.ts";
import type { Widget } from "./widget.ts";

import {
  Bundle,
  BUNDLE_FORMAT,
  buildBundle,
  draftsFromBundle,
  issuePath,
  MAX_BUNDLE_BYTES,
  planImport,
  readBundleText,
  SKIP_REASONS,
} from "./bundle.ts";
import { CARD_SPEC_VERSION } from "./card-spec.ts";

const NOW = new Date("2026-11-20T09:30:00.000Z");

const SECRETS = {
  boardId: "board-id-7f3a",
  connectionId: "conn-id-91be",
  host: "db.internal.example",
  insight: "Europe grew 14% because of the Q3 launch.",
  lastRunAt: "2026-10-11T11:11:11.000Z",
  lastValue: "Secret Customer GmbH",
  password: "hunter2-very-secret",
  shared: "Shared Value Ltd",
  stamp: "2026-03-03T03:03:03.000Z",
  user: "admin_readonly_user",
  widgetId: "widget-id-c0de",
};

const widget = (overrides: Partial<Widget> = {}): Widget => ({
  connectionId: "conn-a",
  createdAt: SECRETS.stamp,
  database: "analytics",
  dialect: "postgresql",
  id: "widget-a",
  lastRunAt: null,
  lastValues: {},
  name: "Revenue by region",
  params: [
    {
      default: "Europe",
      label: "Region",
      name: "region",
      options: ["Europe", "Asia"],
      type: "select",
    },
  ],
  prompt: "revenue by region",
  spec: {
    formats: { mrr: { currency: "USD", kind: "currency" } },
    insight: "An insight about old data.",
    title: "Revenue",
    version: CARD_SPEC_VERSION,
    view: {
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    },
  },
  sqlTemplate:
    "select month, sum(mrr) as mrr from revenue where region = {{region}} group by 1",
  updatedAt: SECRETS.stamp,
  view: "line",
  ...overrides,
});

const board = (overrides: Partial<Board> = {}): Board => ({
  createdAt: SECRETS.stamp,
  emoji: "📈",
  id: "board-a",
  name: "Weekly revenue review",
  refresh: "5m",
  sharedValues: {},
  tiles: [
    { id: "tile-1", size: "l", widgetId: "widget-a" },
    { id: "tile-2", size: "s", view: "table", widgetId: "widget-b" },
  ],
  updatedAt: SECRETS.stamp,
  ...overrides,
});

const connections = [
  { id: "conn-a", name: "analytics", type: "postgresql" },
  { id: "conn-b", name: "warehouse", type: "clickhouse" },
  { id: "conn-unused", name: "unused", type: "mysql" },
];

const twoWidgets = () => [
  widget(),
  widget({
    connectionId: "conn-b",
    dialect: "clickhouse",
    id: "widget-b",
    name: "Signups",
    params: [],
    sqlTemplate: "select count() from signups",
    view: "table",
  }),
];

const sample = () =>
  buildBundle({
    boards: [board()],
    connections,
    now: NOW,
    widgets: twoWidgets(),
  });

const mapAt = <T>(items: readonly T[], at: number, change: (item: T) => T) =>
  items.map((item, index) => (index === at ? change(item) : item));

const accepts = (raw: unknown): boolean => Bundle.safeParse(raw).success;

describe("buildBundle", () => {
  it("assigns refs in order and keeps only the connections in use", () => {
    const bundle = sample();
    expect(bundle.connections).toStrictEqual([
      { name: "analytics", ref: "c1", type: "postgresql" },
      { name: "warehouse", ref: "c2", type: "clickhouse" },
    ]);
    expect(
      bundle.widgets.map((item) => [item.ref, item.connectionRef])
    ).toStrictEqual([
      ["w1", "c1"],
      ["w2", "c2"],
    ]);
    expect(bundle.boards[0]?.tiles).toStrictEqual([
      { size: "l", view: undefined, widgetRef: "w1" },
      { size: "s", view: "table", widgetRef: "w2" },
    ]);
    expect(bundle).toMatchObject({
      exportedAt: NOW.toISOString(),
      format: BUNDLE_FORMAT,
      version: 1,
    });
  });

  it("strips the stored insight", () => {
    expect(sample().widgets[0]?.spec.insight).toBeUndefined();
  });

  it("drops tiles for widgets outside the export and widgets without a connection", () => {
    const bundle = buildBundle({
      boards: [board()],
      connections,
      now: NOW,
      widgets: [widget(), widget({ connectionId: "gone", id: "widget-b" })],
    });
    expect(bundle.widgets).toHaveLength(1);
    expect(bundle.boards[0]?.tiles.map((tile) => tile.widgetRef)).toStrictEqual(
      ["w1"]
    );
  });

  it("never serializes credentials, ids, timestamps, values or insights", () => {
    const leakyConnection = {
      createdAt: SECRETS.stamp,
      database: "/Users/me/secret.db",
      host: SECRETS.host,
      id: SECRETS.connectionId,
      name: "analytics",
      password: SECRETS.password,
      port: 6543,
      type: "postgresql",
      username: SECRETS.user,
    };
    const json = JSON.stringify(
      buildBundle({
        boards: [
          board({
            id: SECRETS.boardId,
            sharedValues: { "region:select": SECRETS.shared },
            tiles: [
              { id: "tile-secret-id", size: "m", widgetId: SECRETS.widgetId },
            ],
          }),
        ],
        connections: [leakyConnection],
        now: NOW,
        widgets: [
          widget({
            connectionId: SECRETS.connectionId,
            id: SECRETS.widgetId,
            lastRunAt: SECRETS.lastRunAt,
            lastValues: { region: SECRETS.lastValue },
            spec: { ...widget().spec, insight: SECRETS.insight },
          }),
        ],
      }),
      null,
      2
    );
    for (const secret of [
      ...Object.values(SECRETS),
      "tile-secret-id",
      "/Users/me/secret.db",
      "6543",
      "region:select",
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("bundle schema", () => {
  it("round-trips through JSON into drafts that keep the widget and board", () => {
    const text = JSON.stringify(sample(), null, 2);
    const parsed = Bundle.parse(JSON.parse(text));
    let n = 0;
    const result = draftsFromBundle(
      parsed,
      { c1: "local-pg", c2: "local-ch" },
      [],
      () => {
        n += 1;
        return `new-tile-${n}`;
      }
    );
    const [revenue, signups] = result.widgets;
    const original = widget();
    const { insight: _insight, ...specWithoutInsight } = original.spec;
    expect(revenue?.draft).toStrictEqual({
      connectionId: "local-pg",
      database: original.database,
      dialect: original.dialect,
      lastValues: {},
      name: original.name,
      params: original.params,
      prompt: original.prompt,
      spec: specWithoutInsight,
      sqlTemplate: original.sqlTemplate,
      view: "line",
    });
    expect(signups?.draft.connectionId).toBe("local-ch");
    const { boards } = result.boardDrafts(
      new Map([
        ["w1", "id-1"],
        ["w2", "id-2"],
      ])
    );
    expect(boards[0]?.draft).toStrictEqual({
      emoji: "📈",
      name: "Weekly revenue review",
      refresh: "5m",
      sharedValues: {},
      tiles: [
        { id: "new-tile-1", size: "l", view: undefined, widgetId: "id-1" },
        { id: "new-tile-2", size: "s", view: "table", widgetId: "id-2" },
      ],
    });
  });

  it("accepts the sample", () => {
    expect(accepts(sample())).toBeTruthy();
  });

  it("rejects a dangling connectionRef or widgetRef", () => {
    const bundle = sample();
    expect(
      accepts({
        ...bundle,
        widgets: mapAt(bundle.widgets, 0, (item) => ({
          ...item,
          connectionRef: "c9",
        })),
      })
    ).toBeFalsy();
    expect(
      accepts({
        ...bundle,
        boards: mapAt(bundle.boards, 0, (item) => ({
          ...item,
          tiles: mapAt(item.tiles, 0, (tile) => ({ ...tile, widgetRef: "w9" })),
        })),
      })
    ).toBeFalsy();
  });

  it("rejects duplicate refs within a kind", () => {
    const bundle = sample();
    expect(
      accepts({
        ...bundle,
        widgets: mapAt(bundle.widgets, 1, (item) => ({ ...item, ref: "w1" })),
      })
    ).toBeFalsy();
    expect(
      accepts({
        ...bundle,
        connections: mapAt(bundle.connections, 1, (item) => ({
          ...item,
          ref: "c1",
        })),
      })
    ).toBeFalsy();
  });

  it("rejects an unknown format and a newer version", () => {
    expect(accepts({ ...sample(), format: "something.else" })).toBeFalsy();
    expect(accepts({ ...sample(), version: 2 })).toBeFalsy();
  });

  it("caps widgets at 200 and board tiles at 24", () => {
    const bundle = sample();
    const [widgetOne] = bundle.widgets;
    const [boardOne] = bundle.boards;
    const tile = { size: "m", widgetRef: "w1" };
    const widgets = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        ...widgetOne,
        ref: `w${i + 1}`,
      }));
    const tiles = (count: number) => ({
      ...bundle,
      boards: [
        { ...boardOne, tiles: Array.from({ length: count }, () => tile) },
      ],
    });
    expect(accepts({ ...bundle, widgets: widgets(200) })).toBeTruthy();
    expect(accepts({ ...bundle, widgets: widgets(201) })).toBeFalsy();
    expect(accepts(tiles(24))).toBeTruthy();
    expect(accepts(tiles(25))).toBeFalsy();
  });

  it("drops keys it doesn't know, so a hand-added password never imports", () => {
    const bundle = sample();
    const raw = {
      ...bundle,
      connections: mapAt(bundle.connections, 0, (item) => ({
        ...item,
        password: SECRETS.password,
      })),
      widgets: mapAt(bundle.widgets, 0, (item) => ({
        ...item,
        lastValues: { region: "x" },
      })),
    };
    const parsed = Bundle.parse(raw);
    expect(JSON.stringify(parsed)).not.toContain(SECRETS.password);
    expect(JSON.stringify(parsed)).not.toContain("lastValues");
  });
});

describe("readBundleText", () => {
  const valid = JSON.stringify(sample());

  it("reads a valid export, ignoring a byte-order mark", () => {
    const read = readBundleText(`﻿${valid}`, "file");
    expect(read.ok).toBeTruthy();
  });

  it("explains an empty clipboard and a file that isn't an export", () => {
    expect(readBundleText(null, "clipboard")).toStrictEqual({
      message: "The clipboard has no oh-my-query export.",
      ok: false,
    });
    expect(readBundleText("   ", "clipboard")).toMatchObject({ ok: false });
    expect(readBundleText("{not json", "file")).toStrictEqual({
      message: "This isn't an oh-my-query export.",
      ok: false,
    });
    expect(readBundleText('{"format":"other"}', "file")).toMatchObject({
      message: "This isn't an oh-my-query export.",
    });
    expect(readBundleText("[1,2]", "clipboard")).toMatchObject({
      message: "The clipboard has no oh-my-query export.",
    });
  });

  it("names a newer version", () => {
    expect(
      readBundleText(JSON.stringify({ ...sample(), version: 2 }), "file")
    ).toMatchObject({
      message: "This export is from a newer version of oh-my-query.",
    });
  });

  it("rejects text over the size cap before parsing it", () => {
    const huge = `{"format":"${BUNDLE_FORMAT}","pad":"${"x".repeat(MAX_BUNDLE_BYTES)}"}`;
    expect(readBundleText(huge, "file")).toStrictEqual({
      message: "The export is larger than 2 MB.",
      ok: false,
    });
    const multibyte = `{"format":"${BUNDLE_FORMAT}","pad":"${"é".repeat(MAX_BUNDLE_BYTES / 2)}"}`;
    expect(readBundleText(multibyte, "file")).toMatchObject({ ok: false });
  });

  it("reports the first issue with its dotted path", () => {
    const bundle = sample();
    const raw = {
      ...bundle,
      widgets: mapAt(bundle.widgets, 1, (item) => ({
        ...item,
        sqlTemplate: "",
      })),
    };
    expect(readBundleText(JSON.stringify(raw), "file")).toStrictEqual({
      message: expect.stringMatching(/^widgets\[1\]\.sqlTemplate: /),
      ok: false,
    });
  });

  it("formats paths with indexes", () => {
    expect(issuePath(["boards", 0, "tiles", 3, "widgetRef"])).toBe(
      "boards[0].tiles[3].widgetRef"
    );
    expect(issuePath([0, "name"])).toBe("[0].name");
  });
});

describe("planImport", () => {
  const local = [
    { id: "pg-1", name: "Analytics", type: "postgresql" },
    { id: "pg-2", name: "staging", type: "postgresql" },
    { id: "ch-1", name: "clicks", type: "clickhouse" },
    { id: "my-1", name: "analytics", type: "mysql" },
  ];

  it("suggests the same-type candidate whose name matches, ignoring case", () => {
    const plan = planImport(sample(), local, []);
    expect(plan.connections[0]).toStrictEqual({
      candidates: [
        { id: "pg-1", name: "Analytics", type: "postgresql" },
        { id: "pg-2", name: "staging", type: "postgresql" },
      ],
      name: "analytics",
      ref: "c1",
      suggestedId: "pg-1",
      type: "postgresql",
    });
  });

  it("suggests the only same-type candidate even when the name differs", () => {
    expect(planImport(sample(), local, []).connections[1]?.suggestedId).toBe(
      "ch-1"
    );
  });

  it("suggests nothing when several candidates share the type but none match", () => {
    const plan = planImport(
      sample(),
      [...local.slice(1), { id: "pg-3", name: "replica", type: "postgresql" }],
      []
    );
    expect(plan.connections[0]?.suggestedId).toBeNull();
  });

  it("returns only id, name and type for each candidate", () => {
    const leaky = local.map((item) => ({
      ...item,
      password: SECRETS.password,
    }));
    expect(JSON.stringify(planImport(sample(), leaky, []))).not.toContain(
      SECRETS.password
    );
  });

  it("detects a duplicate despite whitespace differences", () => {
    const existing = widget({
      connectionId: "pg-1",
      id: "here",
      sqlTemplate: `select month,  sum(mrr) as mrr
        from revenue   where region = {{region}}
        group by 1`,
    });
    const plan = planImport(sample(), local, [existing]);
    expect(plan.widgets).toStrictEqual([
      { duplicateOfWidgetId: "here", ref: "w1" },
      { duplicateOfWidgetId: null, ref: "w2" },
    ]);
  });

  it("doesn't call a widget on another connection a duplicate", () => {
    const existing = widget({ connectionId: "pg-2", id: "elsewhere" });
    expect(
      planImport(sample(), local, [existing]).widgets[0]?.duplicateOfWidgetId
    ).toBeNull();
  });
});

describe("draftsFromBundle", () => {
  it("skips unchecked widgets and widgets without a connection", () => {
    const result = draftsFromBundle(sample(), { c1: "pg-1", c2: null }, ["w1"]);
    expect(result.widgets).toStrictEqual([]);
    expect(result.skipped).toStrictEqual([
      {
        kind: "widget",
        name: "Revenue by region",
        reason: SKIP_REASONS.unchecked,
        ref: "w1",
      },
      {
        kind: "widget",
        name: "Signups",
        reason: SKIP_REASONS.noConnection,
        ref: "w2",
      },
    ]);
  });

  it("keeps only tiles whose widget imported and skips a board left empty", () => {
    const bundle = buildBundle({
      boards: [
        board(),
        board({
          id: "board-b",
          name: "Signups only",
          tiles: [{ id: "t", size: "m", widgetId: "widget-b" }],
        }),
      ],
      connections,
      now: NOW,
      widgets: twoWidgets(),
    });
    const result = draftsFromBundle(bundle, { c1: "pg-1", c2: "ch-1" }, ["w2"]);
    const { boards, skipped } = result.boardDrafts(new Map([["w1", "id-1"]]));
    expect(
      boards.map((item) => item.draft.tiles.map((tile) => tile.widgetId))
    ).toStrictEqual([["id-1"]]);
    expect(skipped).toStrictEqual([
      {
        kind: "board",
        name: "Signups only",
        reason: SKIP_REASONS.noTiles,
        ref: "b2",
      },
    ]);
  });

  it("keeps a board that was empty in the export", () => {
    const bundle = buildBundle({
      boards: [board({ tiles: [] })],
      connections,
      now: NOW,
      widgets: [],
    });
    const { boards } = draftsFromBundle(bundle, {}, []).boardDrafts(new Map());
    expect(boards).toHaveLength(1);
  });
});
