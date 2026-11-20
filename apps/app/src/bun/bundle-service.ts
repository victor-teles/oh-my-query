import type {
  Board,
  BundleConnectionSource,
  ExportBundleResult,
  ExportScope,
  ImportIssue,
  ImportPreview,
  ImportResult,
  ImportSource as ImportSourceValue,
  Widget,
} from "@conch/rpc";

import { DbError } from "@conch/core";
import {
  ApplyImportRequest,
  BUNDLE_EXTENSION,
  BUNDLE_TOO_LARGE,
  buildBundle,
  draftsFromBundle,
  ExportBundleRequest,
  ImportSource,
  issuePath,
  MAX_BUNDLE_BOARDS,
  MAX_BUNDLE_BYTES,
  MAX_BUNDLE_CONNECTIONS,
  MAX_BUNDLE_WIDGETS,
  planImport,
  readBundleText,
  SKIP_REASONS,
} from "@conch/rpc";
import { open } from "node:fs/promises";
import { z } from "zod";

import type { BoardService } from "./board-service.ts";
import type { SaveResult } from "./downloads.ts";
import type { WidgetService } from "./widget-service.ts";

import { slugBaseName } from "./downloads.ts";

export interface BundleFile {
  baseName: string;
  extension: typeof BUNDLE_EXTENSION;
  content: string;
}

export interface BundleServiceDeps {
  widgets: Pick<WidgetService, "listWidgets" | "saveWidget">;
  boards: Pick<BoardService, "listBoards" | "getBoard" | "saveBoard">;
  connections(): Promise<BundleConnectionSource[]>;
  downloads: { save(file: BundleFile): Promise<SaveResult> };
  clipboard: { readText(): string | null; writeText(text: string): void };
  pickFile(): Promise<string | null>;
  readFile(path: string, maxBytes: number): Promise<string | null>;
  now(): Date;
  newId?: () => string;
}

type SourceRead =
  | { kind: "text"; text: string | null }
  | { kind: "cancelled" }
  | { kind: "invalid"; message: string };

interface ScopeContents {
  widgets: Widget[];
  boards: Board[];
  label: string;
}

const NAME_SLUG_LENGTH = 32;

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const yyyymmdd = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

export const exportBaseName = (label: string, now: Date): string => {
  const slug = slugBaseName(slugBaseName(label).slice(0, NAME_SLUG_LENGTH));
  return `conch-${slug || "export"}-${yyyymmdd(now)}`;
};

export const readTextUpTo = async (
  path: string,
  maxBytes: number
): Promise<string | null> => {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    return size > maxBytes ? null : await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
};

const IMPORT_REASONS: Record<string, string> = {
  NOT_READ_ONLY: "Its SQL would change data, so it wasn't imported.",
};

const reasonOf = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    const [issue] = error.issues;
    return issue
      ? `${issuePath(issue.path)}: ${issue.message}`
      : "It isn't valid.";
  }
  const dbError = DbError.fromUnknown(error);
  return IMPORT_REASONS[dbError.code] ?? dbError.message;
};

const checkLimits = (widgets: readonly Widget[], boards: readonly Board[]) => {
  const connectionCount = new Set(widgets.map((item) => item.connectionId))
    .size;
  if (
    widgets.length > MAX_BUNDLE_WIDGETS ||
    boards.length > MAX_BUNDLE_BOARDS ||
    connectionCount > MAX_BUNDLE_CONNECTIONS
  ) {
    throw failure(
      "EXPORT_TOO_LARGE",
      `An export holds up to ${MAX_BUNDLE_WIDGETS} widgets, ${MAX_BUNDLE_BOARDS} boards and ${MAX_BUNDLE_CONNECTIONS} connections. Export a board instead.`
    );
  }
};

export const createBundleService = (deps: BundleServiceDeps) => {
  const resolveScope = async (scope: ExportScope): Promise<ScopeContents> => {
    const widgets = await deps.widgets.listWidgets();
    switch (scope.kind) {
      case "all": {
        return {
          boards: await deps.boards.listBoards(),
          label: "all",
          widgets,
        };
      }
      case "widget": {
        const widget = widgets.find((item) => item.id === scope.widgetId);
        if (!widget) {
          throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
        }
        return { boards: [], label: widget.name, widgets: [widget] };
      }
      case "board": {
        const board = await deps.boards.getBoard(scope.boardId);
        if (!board) {
          throw failure("BOARD_NOT_FOUND", "This board no longer exists.");
        }
        const byId = new Map(widgets.map((item) => [item.id, item]));
        const used = board.tiles.flatMap((tile) => {
          const widget = byId.get(tile.widgetId);
          return widget ? [widget] : [];
        });
        return { boards: [board], label: board.name, widgets: used };
      }
      default: {
        throw new Error(`Unknown export scope ${scope satisfies never}`);
      }
    }
  };

  const readSource = async (source: ImportSourceValue): Promise<SourceRead> => {
    if (source === "clipboard") {
      return { kind: "text", text: deps.clipboard.readText() };
    }
    const path = await deps.pickFile();
    if (!path) {
      return { kind: "cancelled" };
    }
    try {
      const text = await deps.readFile(path, MAX_BUNDLE_BYTES);
      return text === null
        ? { kind: "invalid", message: BUNDLE_TOO_LARGE }
        : { kind: "text", text };
    } catch {
      return { kind: "invalid", message: "The file couldn't be read." };
    }
  };

  const checkConnectionMap = async (request: ApplyImportRequest) => {
    const connections = await deps.connections();
    const local = new Map(connections.map((item) => [item.id, item]));
    const wanted = new Map(
      request.bundle.connections.map((item) => [item.ref, item])
    );
    for (const [ref, connectionId] of Object.entries(request.connectionMap)) {
      const target = wanted.get(ref);
      if (!target) {
        throw failure(
          "INVALID_IMPORT",
          `The export has no connection with the ref "${ref}".`
        );
      }
      if (connectionId === null) {
        continue;
      }
      const chosen = local.get(connectionId);
      if (!chosen) {
        throw failure(
          "CONNECTION_MISSING",
          "A chosen connection no longer exists."
        );
      }
      if (chosen.type !== target.type) {
        throw failure(
          "INVALID_IMPORT",
          `“${chosen.name}” can't stand in for “${target.name}”: it isn't ${target.type}.`
        );
      }
    }
  };

  return {
    async applyImport(input: unknown): Promise<ImportResult> {
      const parsed = ApplyImportRequest.safeParse(input);
      if (!parsed.success) {
        throw failure("INVALID_IMPORT", "The import request isn't valid.");
      }
      const request = parsed.data;
      await checkConnectionMap(request);
      const drafts = draftsFromBundle(
        request.bundle,
        request.connectionMap,
        request.skipWidgetRefs,
        deps.newId
      );
      const skipped: ImportIssue[] = [...drafts.skipped];
      const failed: ImportIssue[] = [];
      const idByRef = new Map<string, string>();

      for (const { ref, name, draft } of drafts.widgets) {
        try {
          const saved = await deps.widgets.saveWidget(draft);
          idByRef.set(ref, saved.id);
        } catch (error) {
          failed.push({ kind: "widget", name, reason: reasonOf(error), ref });
        }
      }

      let boardCount = 0;
      if (request.boards) {
        const planned = drafts.boardDrafts(idByRef);
        skipped.push(...planned.skipped);
        for (const { ref, name, draft } of planned.boards) {
          try {
            await deps.boards.saveBoard(draft);
            boardCount += 1;
          } catch (error) {
            failed.push({ kind: "board", name, reason: reasonOf(error), ref });
          }
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
        boards: boardCount,
        failed,
        importedWidgetIds,
        skipped,
        widgets: importedWidgetIds.length,
      };
    },

    async exportBundle(input: unknown): Promise<ExportBundleResult> {
      const { scope, destination } = ExportBundleRequest.parse(input);
      const contents = await resolveScope(scope);
      checkLimits(contents.widgets, contents.boards);
      const now = deps.now();
      const bundle = buildBundle({
        boards: contents.boards,
        connections: await deps.connections(),
        now,
        widgets: contents.widgets,
      });
      if (bundle.widgets.length === 0 && bundle.boards.length === 0) {
        throw failure("NOTHING_TO_EXPORT", "There's nothing to export yet.");
      }
      const content = JSON.stringify(bundle, null, 2);
      if (Buffer.byteLength(content) > MAX_BUNDLE_BYTES) {
        throw failure(
          "EXPORT_TOO_LARGE",
          "This export would be larger than 2 MB."
        );
      }
      const counts = {
        boards: bundle.boards.length,
        widgets: bundle.widgets.length,
      };
      if (destination === "clipboard") {
        deps.clipboard.writeText(content);
        return { ...counts, fileName: null, savedId: null };
      }
      const saved = await deps.downloads.save({
        baseName: exportBaseName(contents.label, now),
        content,
        extension: BUNDLE_EXTENSION,
      });
      return { ...counts, ...saved };
    },

    async previewImport(input: unknown): Promise<ImportPreview> {
      const { source } = z.object({ source: ImportSource }).parse(input);
      const read = await readSource(source);
      if (read.kind === "cancelled") {
        return { status: "cancelled" };
      }
      if (read.kind === "invalid") {
        return { message: read.message, status: "invalid" };
      }
      const parsed = readBundleText(read.text, source);
      if (!parsed.ok) {
        return { message: parsed.message, status: "invalid" };
      }
      const plan = planImport(
        parsed.bundle,
        await deps.connections(),
        await deps.widgets.listWidgets()
      );
      return { bundle: parsed.bundle, plan, status: "ready" };
    },
  };
};

export type BundleService = ReturnType<typeof createBundleService>;
