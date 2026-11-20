import type { DatabaseConnection } from "@/lib/connections";

export type RowActivity =
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "testing" }
  | { kind: "tested"; latencyMs: number }
  | { kind: "error"; message: string };

export type ConnectionsLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export interface ConnectionsState {
  load: ConnectionsLoad;
  connections: DatabaseConnection[];
  activeId: string | null;
  liveIds: readonly string[];
  activity: Readonly<Record<string, RowActivity>>;
  focusId: string | null;
}

export type ConnectionsAction =
  | { type: "loading" }
  | {
      type: "loaded";
      connections: DatabaseConnection[];
      activeId: string | null;
    }
  | { type: "load-failed"; message: string }
  | { type: "activity"; id: string; activity: RowActivity | null }
  | { type: "activity-settled"; id: string; kind: RowActivity["kind"] }
  | { type: "activated"; id: string; usedAt: string }
  | { type: "disconnected"; id: string }
  | { type: "removed"; id: string }
  | { type: "pin-toggled"; id: string }
  | { type: "saved"; connection: DatabaseConnection; stale: boolean };

export const initialConnectionsState: ConnectionsState = {
  activeId: null,
  activity: {},
  connections: [],
  focusId: null,
  liveIds: [],
  load: { status: "loading" },
};

const withActivity = (
  activity: ConnectionsState["activity"],
  id: string,
  next: RowActivity | null
): ConnectionsState["activity"] => {
  const { [id]: _previous, ...rest } = activity;
  return next ? { ...rest, [id]: next } : rest;
};

const withoutId = (ids: readonly string[], id: string) =>
  ids.filter((value) => value !== id);

const mapConnection = (
  connections: DatabaseConnection[],
  id: string,
  update: (connection: DatabaseConnection) => DatabaseConnection
) =>
  connections.map((connection) =>
    connection.id === id ? update(connection) : connection
  );

const upsert = (
  connections: DatabaseConnection[],
  saved: DatabaseConnection
): DatabaseConnection[] =>
  connections.some((connection) => connection.id === saved.id)
    ? mapConnection(connections, saved.id, () => saved)
    : [...connections, saved];

export const connectionsReducer = (
  state: ConnectionsState,
  action: ConnectionsAction
): ConnectionsState => {
  switch (action.type) {
    case "loading": {
      return { ...state, load: { status: "loading" } };
    }
    case "loaded": {
      const activeExists = action.connections.some(
        (connection) => connection.id === action.activeId
      );
      return {
        ...state,
        activeId: activeExists ? action.activeId : null,
        connections: action.connections,
        load: { status: "ready" },
      };
    }
    case "load-failed": {
      return { ...state, load: { message: action.message, status: "error" } };
    }
    case "activity": {
      return {
        ...state,
        activity: withActivity(state.activity, action.id, action.activity),
      };
    }
    case "activity-settled": {
      return state.activity[action.id]?.kind === action.kind
        ? {
            ...state,
            activity: withActivity(state.activity, action.id, null),
          }
        : state;
    }
    case "activated": {
      return {
        ...state,
        activeId: action.id,
        activity: withActivity(state.activity, action.id, {
          kind: "connected",
        }),
        connections: mapConnection(state.connections, action.id, (c) => ({
          ...c,
          lastConnectedAt: action.usedAt,
        })),
        liveIds: [...withoutId(state.liveIds, action.id), action.id],
      };
    }
    case "disconnected": {
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        activity: withActivity(state.activity, action.id, null),
        liveIds: withoutId(state.liveIds, action.id),
      };
    }
    case "removed": {
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        activity: withActivity(state.activity, action.id, null),
        connections: state.connections.filter((c) => c.id !== action.id),
        focusId: state.focusId === action.id ? null : state.focusId,
        liveIds: withoutId(state.liveIds, action.id),
      };
    }
    case "pin-toggled": {
      return {
        ...state,
        connections: mapConnection(state.connections, action.id, (c) => ({
          ...c,
          pinned: !c.pinned,
        })),
      };
    }
    case "saved": {
      const { id } = action.connection;
      return {
        ...state,
        activity: withActivity(state.activity, id, null),
        connections: upsert(state.connections, action.connection),
        focusId: id,
        liveIds: action.stale ? withoutId(state.liveIds, id) : state.liveIds,
      };
    }
    default: {
      return state;
    }
  }
};
