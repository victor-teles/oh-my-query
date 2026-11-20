import type { Board, BoardDraft, Widget, WidgetDraft } from "@oh-my-query/rpc";

import { DbError } from "@oh-my-query/core";
import { BUNDLE_TOO_LARGE, SKIP_REASONS } from "@oh-my-query/rpc";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { BundleFile } from "./bundle-service.ts";

import {
  createBundleService,
  exportBaseName,
  readTextUpTo,
} from "./bundle-service.ts";

const NOW = new Date("2026-11-20T12:00:00.000Z");

const widget = (id: string, overrides: Partial<Widget> = {}): Widget => ({
  connectionId: "pg",
  createdAt: NOW.toISOString(),
  database: null,
  dialect: "postgresql",
  id,
  lastRunAt: NOW.toISOString(),
  lastValues: {},
  name: `Widget ${id}`,
  params: [],
  prompt: "",
  spec: { formats: {}, title: id, version: 1, view: { kind: "table" } },
  sqlTemplate: `select '${id}'`,
  updatedAt: NOW.toISOString(),
  view: "table",
  ...overrides,
});

const board = (overrides: Partial<Board> = {}): Board => ({
  createdAt: NOW.toISOString(),
  id: "board-1",
  name: "Weekly revenue review",
  refresh: "off",
  sharedValues: { "region:select": "Europe" },
  tiles: [
    { id: "t1", size: "l", widgetId: "w-a" },
    { id: "t2", size: "m", widgetId: "w-b" },
  ],
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const LOCAL = [
  { id: "pg", name: "analytics", type: "postgresql" },
  { id: "pg-2", name: "staging", type: "postgresql" },
  { id: "my", name: "shop", type: "mysql" },
];

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

interface SetupOptions {
  widgets?: Widget[];
  boards?: Board[];
  clipboard?: string | null;
  picked?: string | null;
  fileText?: string | null;
}

const setup = ({
  widgets = [widget("w-a"), widget("w-b"), widget("w-c")],
  boards = [board()],
  clipboard = null,
  picked = null,
  fileText = null,
}: SetupOptions = {}) => {
  const store = { boards: [...boards], widgets: [...widgets] };
  const clip = { text: clipboard };
  let counter = 0;
  const saveWidget = vi.fn((draft: WidgetDraft): Promise<Widget> => {
    if (/\bdelete\b/i.test(draft.sqlTemplate)) {
      return Promise.reject(
        new DbError("NOT_READ_ONLY", "DELETE changes data.")
      );
    }
    counter += 1;
    const saved = widget(`saved-${counter}`, { ...draft, lastRunAt: null });
    store.widgets.push(saved);
    return Promise.resolve(saved);
  });
  const saveBoard = vi.fn((draft: BoardDraft): Promise<Board> => {
    const saved = {
      ...board(),
      ...draft,
      id: `board-saved-${store.boards.length}`,
    };
    store.boards.push(saved);
    return Promise.resolve(saved);
  });
  const deps = {
    boards: {
      getBoard: (id: string) =>
        resolved(store.boards.find((item) => item.id === id) ?? null),
      listBoards: () => resolved(store.boards),
      saveBoard,
    },
    clipboard: {
      readText: () => clip.text,
      writeText: vi.fn((text: string) => {
        clip.text = text;
      }),
    },
    connections: () => resolved(LOCAL),
    downloads: {
      save: vi.fn((file: BundleFile) =>
        resolved({
          fileName: `${file.baseName}.${file.extension}`,
          savedId: "saved-file",
        })
      ),
    },
    newId: () => `tile-${crypto.randomUUID()}`,
    now: () => NOW,
    pickFile: vi.fn(() => resolved(picked)),
    readFile: vi.fn((_path: string, _maxBytes: number) => resolved(fileText)),
    widgets: { listWidgets: () => resolved(store.widgets), saveWidget },
  };
  return {
    clip,
    deps,
    saveBoard,
    saveWidget,
    service: createBundleService(deps),
    store,
  };
};

const clipboardJson = (ctx: ReturnType<typeof setup>) =>
  JSON.parse(ctx.clip.text ?? "");

const exported = async (ctx: ReturnType<typeof setup>) => {
  await ctx.service.exportBundle({
    destination: "clipboard",
    scope: { kind: "all" },
  });
  return clipboardJson(ctx);
};

describe("exportBundle", () => {
  it("saves everything to Downloads as a dated .omq.json", async () => {
    const ctx = setup();
    const result = await ctx.service.exportBundle({
      destination: "file",
      scope: { kind: "all" },
    });
    expect(result).toStrictEqual({
      boards: 1,
      fileName: "oh-my-query-all-20261120.omq.json",
      savedId: "saved-file",
      widgets: 3,
    });
    const file = ctx.deps.downloads.save.mock.calls[0]?.[0];
    expect(file?.extension).toBe("omq.json");
    expect(file?.content).not.toContain("Europe");
    expect(file?.content).not.toContain('"id"');
    expect(file?.content).not.toContain("board-1");
  });

  it("copies one widget to the clipboard", async () => {
    const ctx = setup();
    const result = await ctx.service.exportBundle({
      destination: "clipboard",
      scope: { kind: "widget", widgetId: "w-b" },
    });
    expect(result).toStrictEqual({
      boards: 0,
      fileName: null,
      savedId: null,
      widgets: 1,
    });
    expect(clipboardJson(ctx).widgets[0].name).toBe("Widget w-b");
    expect(ctx.deps.downloads.save).not.toHaveBeenCalled();
  });

  it("exports a board with only its own widgets", async () => {
    const ctx = setup();
    const result = await ctx.service.exportBundle({
      destination: "file",
      scope: { boardId: "board-1", kind: "board" },
    });
    expect(result).toMatchObject({
      boards: 1,
      fileName: "oh-my-query-weekly-revenue-review-20261120.omq.json",
      widgets: 2,
    });
  });

  it("reports a missing widget or board, and an empty export", async () => {
    const ctx = setup();
    await expect(
      ctx.service.exportBundle({
        destination: "file",
        scope: { kind: "widget", widgetId: "gone" },
      })
    ).rejects.toMatchObject({ code: "WIDGET_NOT_FOUND" });
    await expect(
      ctx.service.exportBundle({
        destination: "file",
        scope: { boardId: "gone", kind: "board" },
      })
    ).rejects.toMatchObject({ code: "BOARD_NOT_FOUND" });
    await expect(
      setup({ boards: [], widgets: [] }).service.exportBundle({
        destination: "file",
        scope: { kind: "all" },
      })
    ).rejects.toMatchObject({ code: "NOTHING_TO_EXPORT" });
  });

  it("refuses more widgets than a bundle holds", async () => {
    const many = Array.from({ length: 201 }, (_, i) => widget(`w${i}`));
    await expect(
      setup({ widgets: many }).service.exportBundle({
        destination: "file",
        scope: { kind: "all" },
      })
    ).rejects.toMatchObject({ code: "EXPORT_TOO_LARGE" });
  });
});

describe("previewImport", () => {
  it("plans an import from the clipboard", async () => {
    const source = setup();
    const text = JSON.stringify(await exported(source));
    const preview = await setup({
      clipboard: text,
      widgets: [],
    }).service.previewImport({
      source: "clipboard",
    });
    expect(preview).toMatchObject({
      plan: {
        connections: [{ name: "analytics", ref: "c1", suggestedId: "pg" }],
      },
      status: "ready",
    });
  });

  it("returns cancelled when no file is picked", async () => {
    const ctx = setup({ picked: null });
    await expect(
      ctx.service.previewImport({ source: "file" })
    ).resolves.toStrictEqual({
      status: "cancelled",
    });
    expect(ctx.deps.readFile).not.toHaveBeenCalled();
  });

  it("refuses an oversized or unreadable file", async () => {
    const big = setup({ fileText: null, picked: "/tmp/big.omq.json" });
    await expect(
      big.service.previewImport({ source: "file" })
    ).resolves.toStrictEqual({
      message: BUNDLE_TOO_LARGE,
      status: "invalid",
    });
    const broken = setup({ picked: "/tmp/x.omq.json" });
    broken.deps.readFile.mockRejectedValueOnce(new Error("EACCES"));
    await expect(
      broken.service.previewImport({ source: "file" })
    ).resolves.toStrictEqual({
      message: "The file couldn't be read.",
      status: "invalid",
    });
  });

  it("explains invalid JSON and a schema failure", async () => {
    const json = setup({ fileText: "{oops", picked: "/tmp/a.json" });
    await expect(
      json.service.previewImport({ source: "file" })
    ).resolves.toStrictEqual({
      message: "This isn't an oh-my-query export.",
      status: "invalid",
    });
    const bundle = await exported(setup());
    bundle.widgets[1].sqlTemplate = "";
    const schema = setup({ clipboard: JSON.stringify(bundle) });
    await expect(
      schema.service.previewImport({ source: "clipboard" })
    ).resolves.toStrictEqual({
      message: expect.stringMatching(/^widgets\[1\]\.sqlTemplate: /),
      status: "invalid",
    });
  });
});

describe("applyImport", () => {
  const request = async (overrides: Record<string, unknown> = {}) => ({
    boards: true,
    bundle: await exported(setup()),
    connectionMap: { c1: "pg" },
    skipWidgetRefs: [],
    ...overrides,
  });

  it("creates new widgets and boards with new ids", async () => {
    const ctx = setup({ boards: [], widgets: [] });
    const result = await ctx.service.applyImport(await request());
    expect(result).toMatchObject({
      boards: 1,
      failed: [],
      skipped: [],
      widgets: 3,
    });
    expect(result.importedWidgetIds).toStrictEqual([
      "saved-1",
      "saved-2",
      "saved-3",
    ]);
    for (const [draft] of ctx.saveWidget.mock.calls) {
      expect(draft).not.toHaveProperty("id");
      expect(draft.lastValues).toStrictEqual({});
    }
  });

  it("builds boards from the new widget ids without carrying old ids or values", async () => {
    const ctx = setup({ boards: [], widgets: [] });
    await ctx.service.applyImport(await request());
    const boardDraft = ctx.saveBoard.mock.calls[0]?.[0];
    expect(boardDraft).not.toHaveProperty("id");
    expect(boardDraft?.sharedValues).toStrictEqual({});
    expect(boardDraft?.tiles.map((tile) => tile.widgetId)).toStrictEqual([
      "saved-1",
      "saved-2",
    ]);
    expect(boardDraft?.tiles.map((tile) => tile.id)).not.toContain("t1");
  });

  it("keeps the other widgets when one fails the read-only guard", async () => {
    const bundle = await exported(setup());
    bundle.widgets[0].sqlTemplate = "delete from orders";
    const ctx = setup({ boards: [], widgets: [] });
    const result = await ctx.service.applyImport(await request({ bundle }));
    expect(result.widgets).toBe(2);
    expect(result.failed).toStrictEqual([
      {
        kind: "widget",
        name: "Widget w-a",
        reason: "Its SQL would change data, so it wasn't imported.",
        ref: "w1",
      },
    ]);
    const boardDraft = ctx.saveBoard.mock.calls[0]?.[0];
    expect(boardDraft?.tiles.map((tile) => tile.widgetId)).toStrictEqual([
      "saved-1",
    ]);
  });

  it("skips unchecked widgets and drops their tiles", async () => {
    const ctx = setup({ boards: [], widgets: [] });
    const result = await ctx.service.applyImport(
      await request({ skipWidgetRefs: ["w2"] })
    );
    expect(result.skipped).toStrictEqual([
      {
        kind: "widget",
        name: "Widget w-b",
        reason: SKIP_REASONS.unchecked,
        ref: "w2",
      },
    ]);
    const boardDraft = ctx.saveBoard.mock.calls[0]?.[0];
    expect(boardDraft?.tiles).toHaveLength(1);
  });

  it("skips every widget of an unmapped connection and leaves boards out when asked", async () => {
    const ctx = setup({ boards: [], widgets: [] });
    const result = await ctx.service.applyImport(
      await request({ boards: false, connectionMap: { c1: null } })
    );
    expect(result.widgets).toBe(0);
    expect(result.skipped.map((issue) => issue.reason)).toStrictEqual([
      SKIP_REASONS.noConnection,
      SKIP_REASONS.noConnection,
      SKIP_REASONS.noConnection,
      SKIP_REASONS.boardsOff,
    ]);
    expect(ctx.saveBoard).not.toHaveBeenCalled();
  });

  it("refuses a connection of the wrong type or one that doesn't exist", async () => {
    const ctx = setup();
    await expect(
      ctx.service.applyImport(await request({ connectionMap: { c1: "my" } }))
    ).rejects.toMatchObject({
      code: "INVALID_IMPORT",
    });
    await expect(
      ctx.service.applyImport(await request({ connectionMap: { c1: "nope" } }))
    ).rejects.toMatchObject({
      code: "CONNECTION_MISSING",
    });
    await expect(
      ctx.service.applyImport(await request({ connectionMap: { c7: "pg" } }))
    ).rejects.toMatchObject({
      code: "INVALID_IMPORT",
    });
    expect(ctx.saveWidget).not.toHaveBeenCalled();
  });

  it("re-validates the bundle sent back by the renderer", async () => {
    const ctx = setup();
    const bundle = await exported(setup());
    bundle.widgets[0].connectionRef = "c9";
    await expect(
      ctx.service.applyImport(await request({ bundle }))
    ).rejects.toMatchObject({
      code: "INVALID_IMPORT",
    });
    expect(ctx.saveWidget).not.toHaveBeenCalled();
  });

  it("reports a board that fails to save", async () => {
    const ctx = setup({ boards: [], widgets: [] });
    ctx.saveBoard.mockRejectedValueOnce(new DbError("BOARD_INVALID", "Nope."));
    const result = await ctx.service.applyImport(await request());
    expect(result.boards).toBe(0);
    expect(result.failed).toStrictEqual([
      {
        kind: "board",
        name: "Weekly revenue review",
        reason: "Nope.",
        ref: "b1",
      },
    ]);
  });
});

describe("exportBaseName", () => {
  it("slugs and shortens long names but keeps the date", () => {
    expect(
      exportBaseName("A very long board name that keeps on going forever", NOW)
    ).toBe("oh-my-query-a-very-long-board-name-that-keep-20261120");
    expect(exportBaseName("📈", NOW)).toBe("oh-my-query-export-20261120");
  });
});

describe("readTextUpTo", () => {
  it("reads a file within the limit and refuses a larger one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "omq-bundle-"));
    try {
      const path = join(dir, "export.omq.json");
      await writeFile(path, "{}");
      await expect(readTextUpTo(path, 10)).resolves.toBe("{}");
      await expect(readTextUpTo(path, 1)).resolves.toBeNull();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
