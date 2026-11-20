import type {
  Board,
  BoardDraft,
  BundleConnectionSource,
  ExportBundleResult,
  ExportScope,
  ImportIssue,
  ImportPreview,
  ImportResult,
  ImportSource,
  Widget,
  WidgetDraft,
} from "@oh-my-query/rpc";

import {
  ApplyImportRequest,
  BUNDLE_EXTENSION,
  buildBundle,
  draftsFromBundle,
  ExportBundleRequest,
  planImport,
  readBundleText,
  SKIP_REASONS,
} from "@oh-my-query/rpc";

interface BundleEmulatorDeps {
  listWidgets: () => Widget[];
  saveWidget: (draft: WidgetDraft) => Widget;
  listBoards: () => Board[];
  saveBoard: (draft: BoardDraft) => Board;
  connections: () => BundleConnectionSource[];
  now: () => Date;
}

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code, name: "DbError" });

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// No system clipboard or file panel here: exports land in memory and imports read them back.
export const createBundleEmulator = (deps: BundleEmulatorDeps) => {
  const memory: { clipboard: string | null; file: string | null } = {
    clipboard: null,
    file: null,
  };

  const contentsOf = (scope: ExportScope) => {
    const widgets = deps.listWidgets();
    if (scope.kind === "all") {
      return { boards: deps.listBoards(), widgets };
    }
    if (scope.kind === "widget") {
      return {
        boards: [],
        widgets: widgets.filter((item) => item.id === scope.widgetId),
      };
    }
    const board = deps.listBoards().find((item) => item.id === scope.boardId);
    if (!board) {
      throw failure("BOARD_NOT_FOUND", "This board no longer exists.");
    }
    const ids = new Set(board.tiles.map((tile) => tile.widgetId));
    return {
      boards: [board],
      widgets: widgets.filter((item) => ids.has(item.id)),
    };
  };

  return {
    applyImport: (input: unknown): ImportResult => {
      const request = ApplyImportRequest.parse(input);
      const local = new Map(deps.connections().map((item) => [item.id, item]));
      const types = new Map(
        request.bundle.connections.map((item) => [item.ref, item.type])
      );
      for (const [ref, id] of Object.entries(request.connectionMap)) {
        if (id !== null && local.get(id)?.type !== types.get(ref)) {
          throw failure("INVALID_IMPORT", "That connection doesn't fit.");
        }
      }
      const drafts = draftsFromBundle(
        request.bundle,
        request.connectionMap,
        request.skipWidgetRefs
      );
      const skipped: ImportIssue[] = [...drafts.skipped];
      const failed: ImportIssue[] = [];
      const idByRef = new Map<string, string>();
      for (const { ref, name, draft } of drafts.widgets) {
        try {
          idByRef.set(ref, deps.saveWidget(draft).id);
        } catch (error) {
          failed.push({ kind: "widget", name, reason: messageOf(error), ref });
        }
      }
      let boards = 0;
      if (request.boards) {
        const planned = drafts.boardDrafts(idByRef);
        skipped.push(...planned.skipped);
        for (const { draft } of planned.boards) {
          deps.saveBoard(draft);
          boards += 1;
        }
      } else {
        skipped.push(
          ...request.bundle.boards.map((board) => ({
            kind: "board" as const,
            name: board.name,
            reason: SKIP_REASONS.boardsOff,
            ref: board.ref,
          }))
        );
      }
      const importedWidgetIds = [...idByRef.values()];
      return {
        boards,
        failed,
        importedWidgetIds,
        skipped,
        widgets: importedWidgetIds.length,
      };
    },

    exportBundle: (input: unknown): ExportBundleResult => {
      const { scope, destination } = ExportBundleRequest.parse(input);
      const bundle = buildBundle({
        ...contentsOf(scope),
        connections: deps.connections(),
        now: deps.now(),
      });
      if (bundle.widgets.length === 0 && bundle.boards.length === 0) {
        throw failure("NOTHING_TO_EXPORT", "There's nothing to export yet.");
      }
      const content = JSON.stringify(bundle, null, 2);
      memory.clipboard = content;
      const counts = {
        boards: bundle.boards.length,
        widgets: bundle.widgets.length,
      };
      if (destination === "clipboard") {
        return { ...counts, fileName: null, savedId: null };
      }
      memory.file = content;
      return {
        ...counts,
        fileName: `oh-my-query-export.${BUNDLE_EXTENSION}`,
        savedId: "stub",
      };
    },

    previewImport: ({ source }: { source: ImportSource }): ImportPreview => {
      if (source === "file" && memory.file === null) {
        return { status: "cancelled" };
      }
      const text = source === "file" ? memory.file : memory.clipboard;
      const read = readBundleText(text, source);
      if (!read.ok) {
        return { message: read.message, status: "invalid" };
      }
      return {
        bundle: read.bundle,
        plan: planImport(read.bundle, deps.connections(), deps.listWidgets()),
        status: "ready",
      };
    },
  };
};
