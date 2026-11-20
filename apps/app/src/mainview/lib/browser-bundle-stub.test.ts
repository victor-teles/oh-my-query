import type { Board, BoardDraft, Widget, WidgetDraft } from "@oh-my-query/rpc";

import { SKIP_REASONS } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import { makeBoard, makeTiles } from "@/test/board-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { createBundleEmulator } from "./browser-bundle-stub";

const NOW = new Date("2026-11-20T12:00:00.000Z");

const setup = () => {
  const store: { widgets: Widget[]; boards: Board[] } = {
    boards: [makeBoard({ tiles: makeTiles(["w-revenue"]) })],
    widgets: [makeWidget()],
  };
  const emulator = createBundleEmulator({
    connections: () => [
      { id: "analytics", name: "analytics", type: "postgresql" },
      { id: "shop", name: "shop", type: "mysql" },
    ],
    listBoards: () => store.boards,
    listWidgets: () => store.widgets,
    now: () => NOW,
    saveBoard: (draft: BoardDraft) => {
      const board = {
        ...makeBoard(),
        ...draft,
        id: `b-${store.boards.length}`,
      };
      store.boards.push(board);
      return board;
    },
    saveWidget: (draft: WidgetDraft) => {
      const widget = makeWidget({ ...draft, id: `w-${store.widgets.length}` });
      store.widgets.push(widget);
      return widget;
    },
  });
  return { emulator, store };
};

const readyBundle = (emulator: ReturnType<typeof setup>["emulator"]) => {
  const preview = emulator.previewImport({ source: "clipboard" });
  if (preview.status !== "ready") {
    throw new Error(`expected a ready preview, got ${preview.status}`);
  }
  return preview;
};

describe("createBundleEmulator", () => {
  it("round-trips an export through its in-memory clipboard", () => {
    const { emulator, store } = setup();
    expect(
      emulator.exportBundle({ destination: "file", scope: { kind: "all" } })
    ).toStrictEqual({
      boards: 1,
      fileName: "oh-my-query-export.omq.json",
      savedId: "stub",
      widgets: 1,
    });
    const preview = readyBundle(emulator);
    expect(preview.plan.connections[0]?.suggestedId).toBe("analytics");
    const result = emulator.applyImport({
      boards: true,
      bundle: preview.bundle,
      connectionMap: { c1: "analytics" },
      skipWidgetRefs: [],
    });
    expect(result).toMatchObject({
      boards: 1,
      importedWidgetIds: ["w-1"],
      widgets: 1,
    });
    expect(
      store.boards.at(-1)?.tiles.map((tile) => tile.widgetId)
    ).toStrictEqual(["w-1"]);
  });

  it("exports one board or one widget to the clipboard", () => {
    const { emulator } = setup();
    expect(
      emulator.exportBundle({
        destination: "clipboard",
        scope: { boardId: "b-ops", kind: "board" },
      })
    ).toMatchObject({ boards: 1, fileName: null, widgets: 1 });
    expect(
      emulator.exportBundle({
        destination: "clipboard",
        scope: { kind: "widget", widgetId: "w-revenue" },
      })
    ).toMatchObject({ boards: 0, widgets: 1 });
    expect(() =>
      emulator.exportBundle({
        destination: "clipboard",
        scope: { boardId: "nope", kind: "board" },
      })
    ).toThrow("This board no longer exists.");
  });

  it("refuses an empty export", () => {
    const { emulator, store } = setup();
    store.widgets = [];
    store.boards = [];
    expect(() =>
      emulator.exportBundle({ destination: "file", scope: { kind: "all" } })
    ).toThrow("There's nothing to export yet.");
  });

  it("cancels a file pick before anything was exported and explains an empty clipboard", () => {
    const { emulator } = setup();
    expect(emulator.previewImport({ source: "file" })).toStrictEqual({
      status: "cancelled",
    });
    expect(emulator.previewImport({ source: "clipboard" })).toStrictEqual({
      message: "The clipboard has no oh-my-query export.",
      status: "invalid",
    });
  });

  it("skips boards when asked and refuses a connection of the wrong type", () => {
    const { emulator } = setup();
    emulator.exportBundle({ destination: "clipboard", scope: { kind: "all" } });
    const { bundle } = readyBundle(emulator);
    const result = emulator.applyImport({
      boards: false,
      bundle,
      connectionMap: { c1: "analytics" },
      skipWidgetRefs: [],
    });
    expect(result.skipped.map((issue) => issue.reason)).toStrictEqual([
      SKIP_REASONS.boardsOff,
    ]);
    expect(() =>
      emulator.applyImport({
        boards: true,
        bundle,
        connectionMap: { c1: "shop" },
        skipWidgetRefs: [],
      })
    ).toThrow("That connection doesn't fit.");
  });

  it("reports a widget that fails to save", () => {
    const { emulator, store } = setup();
    emulator.exportBundle({ destination: "clipboard", scope: { kind: "all" } });
    const { bundle } = readyBundle(emulator);
    const failing = createBundleEmulator({
      connections: () => [
        { id: "analytics", name: "analytics", type: "postgresql" },
      ],
      listBoards: () => store.boards,
      listWidgets: () => [],
      now: () => NOW,
      saveBoard: () => makeBoard(),
      saveWidget: () => {
        throw new Error("Nope.");
      },
    });
    const result = failing.applyImport({
      boards: true,
      bundle,
      connectionMap: { c1: "analytics" },
      skipWidgetRefs: [],
    });
    expect(result.failed).toStrictEqual([
      { kind: "widget", name: "Revenue by region", reason: "Nope.", ref: "w1" },
    ]);
    expect(result.skipped[0]?.reason).toBe(SKIP_REASONS.noTiles);
  });
});
