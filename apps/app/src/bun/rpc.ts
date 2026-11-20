import type { RpcSchema } from "@oh-my-query/rpc";

import {
  appendHistory,
  CancellationRegistry,
  createBoardStore,
  DbError,
  describeSqlAssumptions,
  formatSql as doFormatSql,
  getAllHistory,
  getConnections,
  getHistory,
  raceWithCancel,
  resetSecrets,
  saveConnections,
  transpileSql,
} from "@oh-my-query/core";
import { ConnectionPoolManager, getDriver } from "@oh-my-query/drivers";
import {
  Board,
  DEFAULT_CLIPBOARD_LOOKUPS,
  Dialect,
  encodeRpcError,
  MAX_REFINE_SQL,
} from "@oh-my-query/rpc";
import { defineElectrobunRPC, Updater, Utils } from "electrobun/main";
import { z } from "zod";

import type { BoardWindows } from "./board-windows.ts";
import type { LauncherController } from "./launcher.ts";

import {
  loadAskModel,
  readAiSettings,
  removeAiKey,
  testAiSettings,
  writeAiSettings,
} from "./ai-settings-service.ts";
import { createAskService } from "./ask-service.ts";
import { createBoardService } from "./board-service.ts";
import { decodePng } from "./clipboard-image.ts";
import { createClipboardOffer } from "./clipboard-offer.ts";
import { createDownloads, writeExclusive } from "./downloads.ts";
import {
  readActiveConnection,
  readClipboardLookups,
  readLauncherHotkey,
  writeActiveConnection,
  writeClipboardLookups,
} from "./launcher-config.ts";
import { createLookupService } from "./lookup-service.ts";
import { createPasteboardTypes } from "./pasteboard-types-native.ts";
import { createSchemaCache } from "./schema-cache.ts";
import { createSchemaPeek } from "./schema-peek.ts";
import {
  checkForUpdate as doCheckForUpdate,
  installUpdate as doInstallUpdate,
  readChannel as doReadChannel,
  writeChannel as doWriteChannel,
} from "./updater.ts";
import {
  createWidgetService,
  defaultRecentAskStore,
  defaultWidgetStore,
} from "./widget-service.ts";

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): T | null =>
    schema.safeParse(raw).data ?? null;

const describeSqlParams = z.object({
  dialect: Dialect,
  sql: z.string().max(MAX_REFINE_SQL),
});

const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_TIMEOUT_SECS = 30;

const pools = new ConnectionPoolManager();
const cancellation = new CancellationRegistry();
const schemas = createSchemaCache(pools);
const schemaPeek = createSchemaPeek({ pools, schemas });
const downloads = createDownloads({
  dir: () => Utils.paths.downloads,
  reveal: (path) => Utils.showItemInFolder(path),
  writeExclusive,
});

interface AppRpcSchema {
  bun: RpcSchema;
  // The webview doesn't expose any RPC requests of its own; the empty object
  // literal is required so defineElectrobunRPC's generic structural match
  // against BaseRPCRequestsSchema succeeds and the bun-side handler params
  // are inferred from RpcSchema instead of falling back to `any`.
  // oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types
  webview: { requests: {}; messages: RpcSchema["messages"] };
}

type RequestHandlers = {
  [M in keyof RpcSchema["requests"]]: (
    params: RpcSchema["requests"][M]["params"]
  ) =>
    | RpcSchema["requests"][M]["response"]
    | Promise<RpcSchema["requests"][M]["response"]>;
};

type RawHandler = (params: unknown) => unknown;

const TRACED_METHODS = new Set([
  "connectToDatabase",
  "disconnectFromDatabase",
  "listConnectionDatabases",
  "getSchema",
  "getServerVersion",
  "executeQuery",
  "peekSchema",
]);

const wrapHandlers = (handlers: RequestHandlers): RequestHandlers => {
  const wrapped: Record<string, RawHandler> = {};
  for (const [key, fn] of Object.entries(handlers)) {
    const handler = fn as RawHandler;
    const traced = TRACED_METHODS.has(key);
    wrapped[key] = async (params: unknown) => {
      try {
        const result = await handler(params);
        if (traced) {
          console.log(`[rpc] ok  ${key}`);
        }
        return result;
      } catch (error) {
        const err = error as Error & { code?: string };
        console.log(
          `[rpc] err ${key}: name=${err?.name ?? "-"} code=${err?.code ?? "-"} msg=${err?.message ?? "-"}`
        );
        console.log(err?.stack ?? "(no stack)");
        throw encodeRpcError(error);
      }
    };
  }
  return wrapped as RequestHandlers;
};

export interface AppHost {
  launcher(): LauncherController | null;
  boardWindows(): BoardWindows | null;
  toggleLauncherFrom(boardId: string | null): void;
}

const readAppVersion = async (): Promise<string> => {
  const info = await Updater.getLocalInfo();
  return info.version;
};

const boardTitle = (board: { name: string; emoji?: string }): string =>
  board.emoji ? `${board.emoji} ${board.name}` : board.name;

const defineAppRpc = (requests: RequestHandlers) =>
  defineElectrobunRPC<AppRpcSchema>("bun", {
    handlers: { requests },
    // Long queries may legitimately run for minutes; cancelQuery is the
    // user-driven recovery path for hung calls, not a transport-level timeout.
    maxRequestTime: Number.POSITIVE_INFINITY,
  });

export type AppRpc = ReturnType<typeof defineAppRpc>;

export function createAppRpcs(host: AppHost) {
  const live = new Set<AppRpc>();
  const broadcastBoardChanged = (boardId: string) => {
    for (const rpc of live) {
      rpc.send.boardChanged({ boardId });
    }
  };
  const widgetStore = defaultWidgetStore();
  const widgets = createWidgetService({
    loadModel: loadAskModel,
    now: () => new Date(),
    pools,
    recents: defaultRecentAskStore(),
    widgets: widgetStore,
  });
  const boards = createBoardService({
    boards: createBoardStore(parseWith(Board)),
    getWidget: widgetStore.getWidget,
    now: () => new Date(),
    onChanged: broadcastBoardChanged,
  });
  let launcherRpc: AppRpc | null = null;
  const asks = createAskService({
    loadModel: loadAskModel,
    pools,
    rememberAsk: widgets.rememberAsk,
    schemas,
    send: (message) => launcherRpc?.send.askEvent(message),
  });
  const lookups = createLookupService({
    pools,
    schemas,
    send: (message) => launcherRpc?.send.lookupEvent(message),
  });
  const clipboardSetting = { enabled: DEFAULT_CLIPBOARD_LOOKUPS };
  const loadClipboardSetting = async () => {
    try {
      clipboardSetting.enabled = await readClipboardLookups();
    } catch (error) {
      console.error(`[clipboard] could not read the setting: ${String(error)}`);
    }
  };
  const clipboardSettingLoaded = loadClipboardSetting();
  const summonOffer = createClipboardOffer({
    enabled: () => clipboardSetting.enabled,
    formats: createPasteboardTypes(),
    readText: () => Utils.clipboardReadText(),
  });
  const getLauncher = host.launcher;
  const handlers = wrapHandlers({
    addBoardTile: ({ boardId, widgetId }) => boards.addTile(boardId, widgetId),
    appendHistory: async ({ entry }) => {
      await appendHistory(entry);
    },
    ask: (params) => asks.startAsk(params),
    cancelAsk: ({ askId }) => asks.cancelAsk(askId),
    cancelLookup: ({ lookupId }) => lookups.cancelLookup(lookupId),
    cancelQuery: ({ queryId }) => cancellation.cancel(queryId),
    cancelWidgetRun: ({ runId }) => widgets.cancelRun(runId),
    checkForUpdate: () => doCheckForUpdate(),
    clearAiKey: () => removeAiKey(),
    clearRecentAsks: () => widgets.clearRecentAsks(),
    connectToDatabase: async ({ connectionId, params }) => {
      schemas.invalidate(connectionId);
      await pools.connect(connectionId, params);
    },
    copyImage: ({ pngBase64 }) => {
      Utils.clipboardWriteImage(decodePng(pngBase64));
    },
    deleteBoard: async ({ boardId }) => {
      await boards.deleteBoard(boardId);
      host.boardWindows()?.close(boardId);
    },
    deleteRecentAsk: ({ askId }) => widgets.deleteRecentAsk(askId),
    deleteWidget: async ({ widgetId }) => {
      await widgets.deleteWidget(widgetId);
      await boards.removeWidget(widgetId);
    },
    describeSql: (params) => {
      const { sql, dialect } = describeSqlParams.parse(params);
      return describeSqlAssumptions(sql, dialect);
    },
    disconnectFromDatabase: async ({ connectionId }) => {
      schemas.invalidate(connectionId);
      await pools.disconnect(connectionId);
    },
    executeQuery: async ({ params }) => {
      const pool = pools.getPool(params.connectionId);
      const maxRows = params.maxRows ?? DEFAULT_MAX_ROWS;
      const timeoutMs = (params.timeoutSecs ?? DEFAULT_TIMEOUT_SECS) * 1000;

      let { sql } = params;
      if (params.sourceDialect && pool.dialect) {
        sql = await transpileSql(
          params.sql,
          params.sourceDialect,
          pool.dialect
        );
      } else if (params.sourceDialect && !pool.dialect) {
        throw new DbError(
          "UNSUPPORTED_TRANSPILE_TARGET",
          "SQL transpilation is not supported for this database type"
        );
      }

      const controller = params.queryId
        ? cancellation.register(params.queryId)
        : new AbortController();
      const start = performance.now();
      try {
        const result = await raceWithCancel(
          (signal) => pool.execute(sql, maxRows, params.schema ?? null, signal),
          { signal: controller.signal, timeoutMs }
        );
        return {
          ...result,
          executionTimeMs: Math.round(performance.now() - start),
        };
      } finally {
        if (params.queryId) {
          cancellation.remove(params.queryId);
        }
      }
    },
    formatSql: ({ sql, dialect }) => doFormatSql(sql, dialect),
    getActiveConnection: () => readActiveConnection(),
    getAiSettings: () => readAiSettings(),
    getAllHistory: ({ filters }) => getAllHistory(filters ?? {}),
    getAppVersion: () => readAppVersion(),
    getBoard: ({ boardId }) => boards.getBoard(boardId),
    getClipboardLookups: async () => {
      await clipboardSettingLoaded;
      return { enabled: clipboardSetting.enabled };
    },
    getConnections: () => getConnections(),
    getHistory: ({ connectionId, limit, offset }) =>
      getHistory(connectionId, limit ?? null, offset ?? null),
    getLauncherHotkey: () => readLauncherHotkey(),
    getSchema: ({ connectionId, databaseName, force }) =>
      schemas.get(connectionId, databaseName, force),
    getServerVersion: ({ connectionId }) =>
      pools.getPool(connectionId).fetchVersion(),
    getUpdateChannel: () => doReadChannel(),
    hideLauncher: () => {
      getLauncher()?.hide();
    },
    installUpdate: () => doInstallUpdate(),
    listBoards: () => boards.listBoards(),
    listConnectionDatabases: ({ connectionId }) =>
      pools.getPool(connectionId).listDatabases(),
    listRecentAsks: (request) => widgets.listRecentAsks(request),
    listWidgets: () => widgets.listWidgets(),
    loadParamOptions: ({ widgetId, paramName }) =>
      widgets.loadParamOptions(widgetId, paramName),
    lookup: (params) => lookups.startLookup(params),
    openBoard: async ({ boardId }) => {
      const board = await boards.getBoard(boardId);
      if (!board) {
        throw new DbError("BOARD_NOT_FOUND", "This board no longer exists.");
      }
      await host.boardWindows()?.open(board.id, boardTitle(board));
    },
    openExternal: async ({ url }) => {
      await Utils.openExternal(url);
    },
    openWidgetInLauncher: ({ widgetId }) => {
      getLauncher()?.navigate({ kind: "widget-run", widgetId });
    },
    peekSchema: (params) => schemaPeek.peek(params),
    proposeWidgetParams: (request) => widgets.proposeParams(request),
    rendererReady: () => {
      console.log("[rpc] renderer ready");
      getLauncher()?.markRendererReady();
    },
    resetSecrets: async () => {
      await resetSecrets();
    },
    resizeLauncher: ({ height }) => {
      getLauncher()?.resize(height);
    },
    revealSaved: ({ savedId }) => downloads.reveal(savedId),
    runSql: (params) => asks.startSqlRun(params),
    runWidget: (request) => widgets.runWidget(request),
    saveAiSettings: (input) => writeAiSettings(input),
    saveBoard: async ({ board }) => {
      const saved = await boards.saveBoard(board);
      host.boardWindows()?.setTitle(saved.id, boardTitle(saved));
      return saved;
    },
    saveConnections: async ({ connections }) => {
      await saveConnections(connections);
    },
    saveToDownloads: (params) => downloads.save(params, ["csv"]),
    saveWidget: ({ widget }) => widgets.saveWidget(widget),
    setActiveConnection: async ({ active }) => {
      await writeActiveConnection(active);
    },
    setClipboardLookups: async ({ enabled }) => {
      clipboardSetting.enabled = await writeClipboardLookups(enabled);
      return { enabled: clipboardSetting.enabled };
    },
    setUpdateChannel: ({ channel }) => doWriteChannel(channel),
    testAiSettings: (input) => testAiSettings(input),
    testConnection: ({ params }) =>
      getDriver(params.type).testConnection(params),
    toggleLauncher: ({ fromBoardId }) => {
      host.toggleLauncherFrom(fromBoardId);
    },
  });

  const createWindowRpc = (): AppRpc => {
    const rpc = defineAppRpc(handlers);
    live.add(rpc);
    return rpc;
  };
  launcherRpc = createWindowRpc();

  return {
    createWindowRpc,
    launcherRpc,
    releaseWindowRpc: (rpc: AppRpc) => {
      live.delete(rpc);
    },
    summonOffer,
  };
}
