import { z } from "zod";

import type {
  Board as BoardRecord,
  BoardDraft as BoardDraftRecord,
} from "./board.ts";
import type {
  Widget as WidgetRecord,
  WidgetDraft as WidgetDraftRecord,
} from "./widget.ts";

import { Board, MAX_BOARD_TILES, RefreshInterval, TileSize } from "./board.ts";
import { CardSpec } from "./card-spec.ts";
import { CardViewKind, Dialect, Widget } from "./widget.ts";

export const BUNDLE_FORMAT = "conch.bundle";
export const BUNDLE_VERSION = 1;
export const MAX_BUNDLE_BYTES = 2_000_000;
export const BUNDLE_EXTENSION = "conch.json";
export const BUNDLE_TOO_LARGE = "The export is larger than 2 MB.";
export const MAX_BUNDLE_CONNECTIONS = 50;
export const MAX_BUNDLE_WIDGETS = 200;
export const MAX_BUNDLE_BOARDS = 50;

export const BundleRef = z.string().regex(/^[a-z][0-9]{1,4}$/);

export const BundleConnection = z.object({
  name: z.string().trim().min(1).max(200),
  ref: BundleRef,
  type: z.string().min(1).max(40),
});
export type BundleConnection = z.infer<typeof BundleConnection>;

export const BundleWidget = z.object({
  connectionRef: BundleRef,
  database: Widget.shape.database,
  dialect: Dialect,
  name: Widget.shape.name,
  params: Widget.shape.params,
  prompt: Widget.shape.prompt,
  ref: BundleRef,
  spec: CardSpec,
  sqlTemplate: Widget.shape.sqlTemplate,
  view: CardViewKind,
});
export type BundleWidget = z.infer<typeof BundleWidget>;

export const BundleTile = z.object({
  size: TileSize,
  view: CardViewKind.optional(),
  widgetRef: BundleRef,
});

export const BundleBoard = z.object({
  emoji: Board.shape.emoji,
  name: Board.shape.name,
  ref: BundleRef,
  refresh: RefreshInterval,
  tiles: z.array(BundleTile).max(MAX_BOARD_TILES),
});
export type BundleBoard = z.infer<typeof BundleBoard>;

const repeatedIndexes = (refs: readonly string[]): number[] =>
  refs.flatMap((ref, index) => (refs.indexOf(ref) === index ? [] : [index]));

export const Bundle = z
  .object({
    boards: z.array(BundleBoard).max(MAX_BUNDLE_BOARDS),
    connections: z.array(BundleConnection).max(MAX_BUNDLE_CONNECTIONS),
    exportedAt: z.string().max(40),
    format: z.literal(BUNDLE_FORMAT),
    version: z.literal(BUNDLE_VERSION),
    widgets: z.array(BundleWidget).max(MAX_BUNDLE_WIDGETS),
  })
  .superRefine((bundle, ctx) => {
    for (const key of ["connections", "widgets", "boards"] as const) {
      const refs = bundle[key].map((item) => item.ref);
      for (const index of repeatedIndexes(refs)) {
        ctx.addIssue({
          code: "custom",
          message: `The ref "${refs[index]}" is used twice.`,
          path: [key, index, "ref"],
        });
      }
    }
    const connectionRefs = new Set(bundle.connections.map((item) => item.ref));
    for (const [index, widget] of bundle.widgets.entries()) {
      if (!connectionRefs.has(widget.connectionRef)) {
        ctx.addIssue({
          code: "custom",
          message: `No connection has the ref "${widget.connectionRef}".`,
          path: ["widgets", index, "connectionRef"],
        });
      }
    }
    const widgetRefs = new Set(bundle.widgets.map((item) => item.ref));
    for (const [boardIndex, board] of bundle.boards.entries()) {
      for (const [tileIndex, tile] of board.tiles.entries()) {
        if (!widgetRefs.has(tile.widgetRef)) {
          ctx.addIssue({
            code: "custom",
            message: `No widget has the ref "${tile.widgetRef}".`,
            path: ["boards", boardIndex, "tiles", tileIndex, "widgetRef"],
          });
        }
      }
    }
  });
export type Bundle = z.infer<typeof Bundle>;

export interface BundleConnectionSource {
  id: string;
  name: string;
  type: string;
}

interface BuildBundleInput {
  widgets: readonly WidgetRecord[];
  boards: readonly BoardRecord[];
  connections: readonly BundleConnectionSource[];
  now: Date;
}

const withoutInsight = ({ insight: _insight, ...spec }: CardSpec): CardSpec =>
  spec;

// A widget whose connection is gone is left out: nothing says which engine it needs.
export const buildBundle = ({
  widgets,
  boards,
  connections,
  now,
}: BuildBundleInput): Bundle => {
  const connectionById = new Map(connections.map((item) => [item.id, item]));
  const connectionRefById = new Map<string, string>();
  const bundleConnections: BundleConnection[] = [];
  const widgetRefById = new Map<string, string>();
  const bundleWidgets: BundleWidget[] = [];

  for (const widget of widgets) {
    const connection = connectionById.get(widget.connectionId);
    if (!connection || widgetRefById.has(widget.id)) {
      continue;
    }
    let connectionRef = connectionRefById.get(connection.id);
    if (!connectionRef) {
      connectionRef = `c${bundleConnections.length + 1}`;
      connectionRefById.set(connection.id, connectionRef);
      bundleConnections.push({
        name: connection.name.trim().slice(0, 200) || connection.type,
        ref: connectionRef,
        type: connection.type,
      });
    }
    const ref = `w${bundleWidgets.length + 1}`;
    widgetRefById.set(widget.id, ref);
    bundleWidgets.push({
      connectionRef,
      database: widget.database,
      dialect: widget.dialect,
      name: widget.name,
      params: widget.params,
      prompt: widget.prompt,
      ref,
      spec: withoutInsight(widget.spec),
      sqlTemplate: widget.sqlTemplate,
      view: widget.view,
    });
  }

  const bundleBoards = boards.map(
    (board, index): BundleBoard => ({
      emoji: board.emoji,
      name: board.name,
      ref: `b${index + 1}`,
      refresh: board.refresh,
      tiles: board.tiles.flatMap((tile) => {
        const widgetRef = widgetRefById.get(tile.widgetId);
        return widgetRef
          ? [{ size: tile.size, view: tile.view, widgetRef }]
          : [];
      }),
    })
  );

  return Bundle.parse({
    boards: bundleBoards,
    connections: bundleConnections,
    exportedAt: now.toISOString(),
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    widgets: bundleWidgets,
  });
};

export const ImportSource = z.enum(["clipboard", "file"]);
export type ImportSource = z.infer<typeof ImportSource>;

export type BundleRead =
  | { ok: true; bundle: Bundle }
  | { ok: false; message: string };

const NOT_AN_EXPORT: Record<ImportSource, string> = {
  clipboard: "The clipboard has no Conch export.",
  file: "This isn't an Conch export.",
};

export const issuePath = (path: readonly PropertyKey[]): string =>
  path
    .map((part, index) => {
      if (typeof part === "number") {
        return `[${part}]`;
      }
      return index === 0 ? String(part) : `.${String(part)}`;
    })
    .join("");

const byteLength = (text: string): number =>
  // UTF-8 never uses fewer bytes than UTF-16 code units.
  text.length > MAX_BUNDLE_BYTES
    ? text.length
    : new TextEncoder().encode(text).length;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const envelopeOf = (value: unknown): { format?: unknown; version?: unknown } =>
  typeof value === "object" && value !== null ? value : {};

export const readBundleText = (
  text: string | null,
  source: ImportSource
): BundleRead => {
  const trimmed = (text ?? "").replace(/^﻿/, "").trim();
  if (trimmed === "") {
    return { message: NOT_AN_EXPORT[source], ok: false };
  }
  if (byteLength(trimmed) > MAX_BUNDLE_BYTES) {
    return { message: BUNDLE_TOO_LARGE, ok: false };
  }
  const value = parseJson(trimmed);
  const envelope = envelopeOf(value);
  if (envelope.format !== BUNDLE_FORMAT) {
    return { message: NOT_AN_EXPORT[source], ok: false };
  }
  if (
    typeof envelope.version === "number" &&
    envelope.version > BUNDLE_VERSION
  ) {
    return {
      message: "This export is from a newer version of Conch.",
      ok: false,
    };
  }
  const parsed = Bundle.safeParse(value);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const where = issue && issue.path.length > 0 ? issuePath(issue.path) : null;
    const reason = issue?.message ?? "The export isn't valid.";
    return { message: where ? `${where}: ${reason}` : reason, ok: false };
  }
  return { bundle: parsed.data, ok: true };
};

export interface ImportCandidate {
  id: string;
  name: string;
  type: string;
}

export interface ConnectionPlan {
  ref: string;
  name: string;
  type: string;
  candidates: ImportCandidate[];
  suggestedId: string | null;
}

export interface WidgetPlan {
  ref: string;
  duplicateOfWidgetId: string | null;
}

export interface ImportPlan {
  connections: ConnectionPlan[];
  widgets: WidgetPlan[];
}

const collapseWhitespace = (sql: string): string =>
  sql.replaceAll(/\s+/g, " ").trim();

const suggestFor = (
  connection: BundleConnection,
  candidates: readonly ImportCandidate[]
): string | null => {
  const wanted = connection.name.toLowerCase();
  const named = candidates.find((item) => item.name.toLowerCase() === wanted);
  if (named) {
    return named.id;
  }
  return candidates.length === 1 ? (candidates[0]?.id ?? null) : null;
};

export const planImport = (
  bundle: Bundle,
  local: readonly ImportCandidate[],
  existing: readonly WidgetRecord[]
): ImportPlan => {
  const connections = bundle.connections.map((connection): ConnectionPlan => {
    const candidates = local
      .filter((item) => item.type === connection.type)
      .map(({ id, name, type }) => ({ id, name, type }));
    return {
      candidates,
      name: connection.name,
      ref: connection.ref,
      suggestedId: suggestFor(connection, candidates),
      type: connection.type,
    };
  });
  const suggested = new Map(
    connections.map((item) => [item.ref, item.suggestedId])
  );
  const widgets = bundle.widgets.map((widget): WidgetPlan => {
    const connectionId = suggested.get(widget.connectionRef) ?? null;
    const template = collapseWhitespace(widget.sqlTemplate);
    const duplicate = connectionId
      ? existing.find(
          (item) =>
            item.name === widget.name &&
            item.connectionId === connectionId &&
            collapseWhitespace(item.sqlTemplate) === template
        )
      : undefined;
    return { duplicateOfWidgetId: duplicate?.id ?? null, ref: widget.ref };
  });
  return { connections, widgets };
};

export type ImportIssueKind = "widget" | "board";

export interface ImportIssue {
  kind: ImportIssueKind;
  ref: string;
  name: string;
  reason: string;
}

export const SKIP_REASONS = {
  boardsOff: "Boards weren't selected",
  noConnection: "No connection chosen",
  noTiles: "None of its widgets were imported",
  unchecked: "Not selected",
} as const;

export type ConnectionMap = Record<string, string | null>;

export interface WidgetImportDraft {
  ref: string;
  name: string;
  draft: WidgetDraftRecord;
}

export interface BoardImportDraft {
  ref: string;
  name: string;
  draft: BoardDraftRecord;
}

export const draftsFromBundle = (
  bundle: Bundle,
  connectionMap: ConnectionMap,
  skip: readonly string[],
  newId: () => string = () => crypto.randomUUID()
) => {
  const skipped = new Set(skip);
  const widgets: WidgetImportDraft[] = [];
  const issues: ImportIssue[] = [];

  for (const widget of bundle.widgets) {
    const connectionId = connectionMap[widget.connectionRef] ?? null;
    const base = {
      kind: "widget" as const,
      name: widget.name,
      ref: widget.ref,
    };
    if (skipped.has(widget.ref)) {
      issues.push({ ...base, reason: SKIP_REASONS.unchecked });
      continue;
    }
    if (!connectionId) {
      issues.push({ ...base, reason: SKIP_REASONS.noConnection });
      continue;
    }
    widgets.push({
      draft: {
        connectionId,
        database: widget.database,
        dialect: widget.dialect,
        lastValues: {},
        name: widget.name,
        params: widget.params,
        prompt: widget.prompt,
        spec: withoutInsight(widget.spec),
        sqlTemplate: widget.sqlTemplate,
        view: widget.view,
      },
      name: widget.name,
      ref: widget.ref,
    });
  }

  const boardDrafts = (idByRef: ReadonlyMap<string, string>) => {
    const boards: BoardImportDraft[] = [];
    const dropped: ImportIssue[] = [];
    for (const board of bundle.boards) {
      const tiles = board.tiles.flatMap((tile) => {
        const widgetId = idByRef.get(tile.widgetRef);
        return widgetId
          ? [{ id: newId(), size: tile.size, view: tile.view, widgetId }]
          : [];
      });
      if (board.tiles.length > 0 && tiles.length === 0) {
        dropped.push({
          kind: "board",
          name: board.name,
          reason: SKIP_REASONS.noTiles,
          ref: board.ref,
        });
        continue;
      }
      boards.push({
        draft: {
          emoji: board.emoji,
          name: board.name,
          refresh: board.refresh,
          sharedValues: {},
          tiles,
        },
        name: board.name,
        ref: board.ref,
      });
    }
    return { boards, skipped: dropped };
  };

  return { boardDrafts, skipped: issues, widgets };
};

export const ExportScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("widget"), widgetId: z.string().min(1).max(100) }),
  z.object({ boardId: z.string().min(1).max(100), kind: z.literal("board") }),
]);
export type ExportScope = z.infer<typeof ExportScope>;

export const ExportDestination = z.enum(["file", "clipboard"]);
export type ExportDestination = z.infer<typeof ExportDestination>;

export const ExportBundleRequest = z.object({
  destination: ExportDestination,
  scope: ExportScope,
});
export type ExportBundleRequest = z.infer<typeof ExportBundleRequest>;

export interface ExportBundleResult {
  widgets: number;
  boards: number;
  fileName: string | null;
  savedId: string | null;
}

export type ImportPreview =
  | { status: "cancelled" }
  | { status: "invalid"; message: string }
  | { status: "ready"; bundle: Bundle; plan: ImportPlan };

export const ApplyImportRequest = z.object({
  boards: z.boolean(),
  bundle: Bundle,
  connectionMap: z.record(BundleRef, z.string().min(1).max(200).nullable()),
  skipWidgetRefs: z.array(BundleRef).max(MAX_BUNDLE_WIDGETS),
});
export type ApplyImportRequest = z.infer<typeof ApplyImportRequest>;

export interface ImportResult {
  widgets: number;
  boards: number;
  importedWidgetIds: string[];
  skipped: ImportIssue[];
  failed: ImportIssue[];
}
