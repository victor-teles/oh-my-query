import type { DatabaseConnection } from "@conch/core/client";
import type {
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  AskParams,
  RedactedAiSettings,
  RpcSchema,
  BoardDraft,
  LookupRequest,
  RunSqlParams,
  RunWidgetRequest,
  WidgetDraft,
} from "@conch/rpc";

import { DEFAULT_CLIPBOARD_LOOKUPS, DEFAULT_LAUNCHER_HOTKEY } from "@conch/rpc";

import { createAskEmulator } from "@/lib/browser-ask-stub";
import { createBoardEmulator } from "@/lib/browser-board-stub";
import {
  createClipboardEmulator,
  createLookupEmulator,
} from "@/lib/browser-lookup-stub";
import { recordedAssumptions } from "@/lib/browser-refine-stub";
import { demoSchemaPeek } from "@/lib/browser-schema-stub";
import { createWidgetEmulator } from "@/lib/browser-widget-stub";

type RpcMessages = RpcSchema["messages"];

export type EmitMessage = <M extends keyof RpcMessages>(
  name: M,
  payload: RpcMessages[M]
) => void;

type RequestStub = Record<string, (payload?: unknown) => Promise<unknown>>;

const CONNECTIONS_KEY = "conch-connections";
const ACTIVE_CONNECTION_KEY = "conch-active-connection";
const AI_SETTINGS_KEY = "conch-ai-settings";
const CLIPBOARD_LOOKUPS_KEY = "conch-clipboard-lookups";

const readJson = (key: string): unknown => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readConnections = (): DatabaseConnection[] => {
  const parsed = readJson(CONNECTIONS_KEY);
  return Array.isArray(parsed) ? (parsed as DatabaseConnection[]) : [];
};

// Browser mode only backs vite-only dev and e2e; never persist credentials.
const writeConnections = (connections: DatabaseConnection[]): void => {
  const sanitized = connections.map((connection) => ({
    ...connection,
    password: "",
  }));
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(sanitized));
};

const readActiveConnection = (): ActiveConnection | null =>
  (readJson(ACTIVE_CONNECTION_KEY) as ActiveConnection | null) ?? null;

const writeActiveConnection = (active: ActiveConnection | null): void => {
  if (!active) {
    localStorage.removeItem(ACTIVE_CONNECTION_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_CONNECTION_KEY, JSON.stringify(active));
};

const KEY_HINT_MIN_LENGTH = 12;

const hintFor = (key: string | undefined): string | null =>
  key && key.length >= KEY_HINT_MIN_LENGTH ? key.slice(-4) : null;

const testAiSettings = (): AiTestResult => ({
  latencyMs: 0,
  message: "AI tests need the desktop app.",
  ok: false,
});

const readAiSettings = (): RedactedAiSettings | null =>
  (readJson(AI_SETTINGS_KEY) as RedactedAiSettings | null) ?? null;

// Stores the redacted record only; the stub never holds an API key.
const writeAiSettings = (settings: RedactedAiSettings | null): void => {
  if (settings) {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } else {
    localStorage.removeItem(AI_SETTINGS_KEY);
  }
};

const createAiSettingsStore = () => {
  const state: { settings: RedactedAiSettings | null } = {
    settings: readAiSettings(),
  };

  const save = (input: AiSettingsInput): RedactedAiSettings => {
    const current = state.settings;
    const key = input.apiKey?.trim();
    const kept =
      key === undefined && current?.provider === input.provider
        ? current
        : null;
    state.settings = {
      baseUrl: input.baseUrl?.trim() || null,
      hasKey: kept ? kept.hasKey : Boolean(key),
      keyHint: kept ? kept.keyHint : hintFor(key),
      model: input.model?.trim() || null,
      provider: input.provider,
    };
    writeAiSettings(state.settings);
    return state.settings;
  };

  const clearKey = (): RedactedAiSettings | null => {
    if (state.settings) {
      state.settings = { ...state.settings, hasKey: false, keyHint: null };
      writeAiSettings(state.settings);
    }
    return state.settings;
  };

  return { clearKey, get: () => state.settings, save };
};

const readClipboardLookups = (): boolean => {
  const stored = readJson(CLIPBOARD_LOOKUPS_KEY);
  return typeof stored === "boolean" ? stored : DEFAULT_CLIPBOARD_LOOKUPS;
};

const writeClipboardLookups = (enabled: boolean): { enabled: boolean } => {
  localStorage.setItem(CLIPBOARD_LOOKUPS_KEY, JSON.stringify(enabled));
  return { enabled };
};

const isLauncherHotkey = (event: KeyboardEvent): boolean =>
  event.altKey && event.shiftKey && event.code === "Space";

const createLauncherEmulator = (emit: EmitMessage) => {
  const launcher = { visible: true };
  const clipboard = createClipboardEmulator(readClipboardLookups);
  window.addEventListener("keydown", (event) => {
    if (!isLauncherHotkey(event)) {
      return;
    }
    event.preventDefault();
    if (launcher.visible) {
      emit("launcherToggle", {});
      return;
    }
    launcher.visible = true;
    emit("launcherShown", { clipboard: clipboard.offer() });
  });
  return {
    hide: () => {
      launcher.visible = false;
    },
  };
};

const noop = (): undefined => undefined;

const createDispatcher = (emit: EmitMessage) => {
  const ai = createAiSettingsStore();
  const launcher = createLauncherEmulator(emit);
  const widgets = createWidgetEmulator();
  const boards = createBoardEmulator({
    now: () => new Date(),
    onChanged: (boardId) => emit("boardChanged", { boardId }),
    viewOf: (widgetId) =>
      widgets.listWidgets().find((widget) => widget.id === widgetId)?.view ??
      null,
  });
  const lookups = createLookupEmulator((payload) =>
    emit("lookupEvent", payload)
  );
  const asks = createAskEmulator((payload) => emit("askEvent", payload), {
    labelFor: (connectionId) =>
      readConnections().find((connection) => connection.id === connectionId)
        ?.name ?? "demo",
    onAnswered: widgets.rememberAsk,
  });

  const handlers: Record<string, (payload: unknown) => unknown> = {
    addBoardTile: (payload) =>
      boards.addBoardTile(payload as { boardId: string; widgetId: string }),
    ask: (payload) => asks.ask(payload as AskParams),
    cancelAsk: (payload) => asks.cancel((payload as { askId: string }).askId),
    cancelLookup: (payload) =>
      lookups.cancel((payload as { lookupId: string }).lookupId),
    cancelWidgetRun: noop,
    clearAiKey: () => ai.clearKey(),
    clearRecentAsks: () => widgets.clearRecentAsks(),
    connectToDatabase: noop,
    copyImage: noop,
    deleteBoard: (payload) =>
      boards.deleteBoard(payload as { boardId: string }),
    deleteRecentAsk: (payload) =>
      widgets.deleteRecentAsk(payload as { askId: string }),
    deleteWidget: (payload) => {
      const { widgetId } = payload as { widgetId: string };
      widgets.deleteWidget({ widgetId });
      boards.removeWidget(widgetId);
    },
    describeSql: (payload) =>
      recordedAssumptions((payload as { sql: string }).sql),
    disconnectFromDatabase: noop,
    getActiveConnection: () => readActiveConnection(),
    getAiSettings: () => ai.get(),
    getAllHistory: () => [],
    getAppVersion: () => "dev",
    getBoard: (payload) => boards.getBoard(payload as { boardId: string }),
    getClipboardLookups: () => ({ enabled: readClipboardLookups() }),
    getConnections: () => readConnections(),
    getHistory: () => [],
    getLauncherHotkey: () => DEFAULT_LAUNCHER_HOTKEY,
    getUpdateChannel: () => "stable",
    hideLauncher: () => launcher.hide(),
    listBoards: () => boards.listBoards(),
    listRecentAsks: (payload) =>
      widgets.listRecentAsks(payload as { limit?: number }),
    listWidgets: () => widgets.listWidgets(),
    loadParamOptions: () => widgets.loadParamOptions(),
    lookup: (payload) => lookups.lookup(payload as LookupRequest),
    openBoard: (payload) => {
      const { boardId } = payload as { boardId: string };
      window.open(`#/board/${encodeURIComponent(boardId)}`, "_blank");
    },
    openWidgetInLauncher: noop,
    peekSchema: () => demoSchemaPeek(),
    proposeWidgetParams: (payload) =>
      widgets.proposeWidgetParams(payload as { sql: string }),
    rendererReady: noop,
    resizeLauncher: noop,
    revealSaved: noop,
    runSql: (payload) => asks.runSql(payload as RunSqlParams),
    runWidget: (payload) => widgets.runWidget(payload as RunWidgetRequest),
    saveAiSettings: (payload) => ai.save(payload as AiSettingsInput),
    saveBoard: (payload) => boards.saveBoard(payload as { board: BoardDraft }),
    saveConnections: (payload) =>
      writeConnections(
        (payload as { connections: DatabaseConnection[] }).connections
      ),
    saveToDownloads: (payload) => ({
      fileName: `${(payload as { baseName: string }).baseName}.csv`,
      savedId: "stub",
    }),
    saveWidget: (payload) =>
      widgets.saveWidget(payload as { widget: WidgetDraft }),
    setActiveConnection: (payload) =>
      writeActiveConnection(
        (payload as { active: ActiveConnection | null }).active
      ),
    setClipboardLookups: (payload) =>
      writeClipboardLookups((payload as { enabled: boolean }).enabled),
    testAiSettings,
    testConnection: () => ({
      latencyMs: 0,
      message: "Connected",
      success: true,
    }),
    toggleLauncher: noop,
  };

  return (name: string, payload: unknown): unknown => {
    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Browser-mode IPC stub does not implement '${name}'`);
    }
    return handler(payload);
  };
};

export interface IpcCall {
  name: string;
  payload: unknown;
}

// e2e reads this to assert which requests ran (for example, that a widget
// run never asked the model).
export const createBrowserIpcStub = (emit: EmitMessage): RequestStub => {
  const callLog: IpcCall[] = [];
  Object.defineProperty(globalThis, "__conchIpcLog", {
    configurable: true,
    value: callLog,
  });
  const dispatch = createDispatcher(emit);
  return new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (payload?: unknown): Promise<unknown> => {
          callLog.push({ name, payload });
          try {
            return Promise.resolve(dispatch(name, payload));
          } catch (error) {
            return Promise.reject(error);
          }
        },
    }
  );
};
