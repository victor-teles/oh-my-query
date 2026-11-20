import type {
  ConnectionParams,
  DatabaseConnection,
  DialectType,
  ExecuteResult,
  HistoryEntry,
  HistoryFilters,
  QueryParams,
  SchemaInfo,
  TestConnectionResult,
} from "@conch/core";
import type { LookupValue } from "@conch/core/client";

import type {
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  RedactedAiSettings,
} from "./ai-providers.ts";
import type { AskEventMessage, AskParams } from "./ask.ts";
import type { SqlAssumptions } from "./assumptions.ts";
import type { Board, BoardDraft } from "./board.ts";
import type {
  ApplyImportRequest,
  ExportBundleRequest,
  ExportBundleResult,
  ImportPreview,
  ImportResult,
  ImportSource,
} from "./bundle.ts";
import type { LookupEventMessage, LookupRequest } from "./lookup.ts";
import type { RunSqlParams, SchemaPeek } from "./sql-run.ts";
import type { Watch, WatchDraft, WatchStatus, WidgetTrend } from "./watch.ts";
import type {
  ProposeParamsRequest,
  ProposeParamsResult,
  RecentAsk,
  RunWidgetRequest,
  Widget,
  WidgetDraft,
  WidgetRunResult,
} from "./widget.ts";

export type LauncherNavigateView =
  | "root"
  | "settings"
  | { kind: "widget-run"; widgetId: string }
  | "watches";

export const DEFAULT_LAUNCHER_HOTKEY = "Option+Shift+Space";

export const DEFAULT_CLIPBOARD_LOOKUPS = false;

export type UpdateChannel = "stable" | "beta" | "nightly";

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export interface RpcSchema {
  requests: {
    testConnection: {
      params: { params: ConnectionParams };
      response: TestConnectionResult;
    };
    connectToDatabase: {
      params: { connectionId: string; params: ConnectionParams };
      response: void;
    };
    disconnectFromDatabase: {
      params: { connectionId: string };
      response: void;
    };
    getServerVersion: {
      params: { connectionId: string };
      response: string;
    };
    listConnectionDatabases: {
      params: { connectionId: string };
      response: string[];
    };
    getSchema: {
      params: {
        connectionId: string;
        databaseName: string;
        force?: boolean;
      };
      response: SchemaInfo;
    };
    executeQuery: {
      params: { params: QueryParams };
      response: ExecuteResult;
    };
    cancelQuery: {
      params: { queryId: string };
      response: boolean;
    };
    formatSql: {
      params: { sql: string; dialect: string };
      response: string;
    };
    describeSql: {
      params: { sql: string; dialect: DialectType };
      response: SqlAssumptions | null;
    };

    getAiSettings: {
      params: Record<string, never>;
      response: RedactedAiSettings | null;
    };
    saveAiSettings: { params: AiSettingsInput; response: RedactedAiSettings };
    clearAiKey: {
      params: Record<string, never>;
      response: RedactedAiSettings | null;
    };
    testAiSettings: { params: AiSettingsInput; response: AiTestResult };
    getActiveConnection: {
      params: Record<string, never>;
      response: ActiveConnection | null;
    };
    setActiveConnection: {
      params: { active: ActiveConnection | null };
      response: void;
    };
    getLauncherHotkey: { params: Record<string, never>; response: string };
    getAppVersion: { params: Record<string, never>; response: string };
    appendHistory: { params: { entry: HistoryEntry }; response: void };
    getHistory: {
      params: {
        connectionId: string;
        limit?: number | null;
        offset?: number | null;
      };
      response: HistoryEntry[];
    };
    getAllHistory: {
      params: { filters?: HistoryFilters | null };
      response: HistoryEntry[];
    };
    getConnections: {
      params: Record<string, never>;
      response: DatabaseConnection[];
    };
    saveConnections: {
      params: { connections: DatabaseConnection[] };
      response: void;
    };
    resetSecrets: {
      params: Record<string, never>;
      response: void;
    };

    getUpdateChannel: {
      params: Record<string, never>;
      response: UpdateChannel;
    };
    setUpdateChannel: {
      params: { channel: UpdateChannel };
      response: UpdateChannel;
    };
    checkForUpdate: {
      params: Record<string, never>;
      response: AvailableUpdate | null;
    };
    installUpdate: { params: Record<string, never>; response: boolean };

    openExternal: { params: { url: string }; response: void };
    copyImage: { params: { pngBase64: string }; response: void };
    saveToDownloads: {
      params: { baseName: string; extension: "csv"; content: string };
      response: { fileName: string; savedId: string };
    };
    revealSaved: { params: { savedId: string }; response: void };

    resizeLauncher: { params: { height: number }; response: void };
    hideLauncher: { params: Record<string, never>; response: void };

    rendererReady: {
      params: Record<string, never>;
      response: void;
    };

    ask: { params: AskParams; response: void };
    runSql: { params: RunSqlParams; response: void };
    peekSchema: { params: { connectionId: string }; response: SchemaPeek };
    cancelAsk: { params: { askId: string }; response: void };
    lookup: { params: LookupRequest; response: void };
    cancelLookup: { params: { lookupId: string }; response: void };
    getClipboardLookups: {
      params: Record<string, never>;
      response: { enabled: boolean };
    };
    setClipboardLookups: {
      params: { enabled: boolean };
      response: { enabled: boolean };
    };

    listWidgets: { params: Record<string, never>; response: Widget[] };
    saveWidget: { params: { widget: WidgetDraft }; response: Widget };
    deleteWidget: { params: { widgetId: string }; response: void };
    listRecentAsks: { params: { limit?: number }; response: RecentAsk[] };
    deleteRecentAsk: { params: { askId: string }; response: void };
    clearRecentAsks: { params: Record<string, never>; response: void };
    proposeWidgetParams: {
      params: ProposeParamsRequest;
      response: ProposeParamsResult;
    };
    runWidget: { params: RunWidgetRequest; response: WidgetRunResult };
    cancelWidgetRun: { params: { runId: string }; response: void };
    listBoards: { params: Record<string, never>; response: Board[] };
    getBoard: { params: { boardId: string }; response: Board | null };
    saveBoard: { params: { board: BoardDraft }; response: Board };
    deleteBoard: { params: { boardId: string }; response: void };
    addBoardTile: {
      params: { boardId: string; widgetId: string };
      response: Board;
    };
    openBoard: { params: { boardId: string }; response: void };
    toggleLauncher: {
      params: { fromBoardId: string | null };
      response: void;
    };
    openWidgetInLauncher: { params: { widgetId: string }; response: void };
    loadParamOptions: {
      params: { widgetId: string; paramName: string };
      response: string[];
    };
    exportBundle: {
      params: ExportBundleRequest;
      response: ExportBundleResult;
    };
    previewImport: {
      params: { source: ImportSource };
      response: ImportPreview;
    };
    applyImport: { params: ApplyImportRequest; response: ImportResult };
    listWatches: { params: Record<string, never>; response: Watch[] };
    saveWatch: { params: { watch: WatchDraft }; response: Watch };
    deleteWatch: { params: { watchId: string }; response: void };
    listWatchStatuses: {
      params: Record<string, never>;
      response: WatchStatus[];
    };
    listWidgetTrends: {
      params: { widgetIds: string[] };
      response: Record<string, WidgetTrend>;
    };
    acknowledgeAlert: { params: { watchId: string }; response: void };
    setWatchingPaused: { params: { paused: boolean }; response: void };
    getWatchingPaused: { params: Record<string, never>; response: boolean };
  };
  messages: {
    launcherShown: { clipboard: LookupValue | null };
    launcherToggle: Record<string, never>;
    launcherDismiss: Record<string, never>;
    launcherNavigate: { view: LauncherNavigateView };
    updateProgress: { percent: number; downloaded: number; total: number };
    askEvent: AskEventMessage;
    lookupEvent: LookupEventMessage;
    boardChanged: { boardId: string };
    watchesChanged: Record<string, never>;
    widgetSampled: { widgetId: string; valuesKey: string };
  };
}
