import type { LookupSkips } from "@conch/core/client";

import type {
  LookupErrorCode,
  LookupEvent,
  LookupHit,
  LookupValue,
} from "@/lib/ipc";

export type LookupStatus =
  | "idle"
  | "planning"
  | "probing"
  | "done"
  | "error"
  | "cancelled";

export interface LookupFailure {
  code: LookupErrorCode;
  message: string;
}

export interface LookupState {
  lookupId: string | null;
  value: LookupValue | null;
  connectionId: string | null;
  status: LookupStatus;
  tables: number;
  total: number;
  done: number;
  hits: LookupHit[];
  firstHit: LookupHit | null;
  failed: number;
  skipped: LookupSkips;
  elapsedMs: number | null;
  budgetExceeded: boolean;
  error: LookupFailure | null;
}

export type LookupAction =
  | {
      type: "start";
      lookupId: string;
      value: LookupValue;
      connectionId: string;
    }
  | { type: "event"; lookupId: string; event: LookupEvent }
  | { type: "cancel" };

const NO_SKIPS: LookupSkips = {
  largeUnindexed: 0,
  outOfRange: 0,
  overLimit: 0,
};

export const initialLookupState: LookupState = {
  budgetExceeded: false,
  connectionId: null,
  done: 0,
  elapsedMs: null,
  error: null,
  failed: 0,
  firstHit: null,
  hits: [],
  lookupId: null,
  skipped: NO_SKIPS,
  status: "idle",
  tables: 0,
  total: 0,
  value: null,
};

export const isSearching = (status: LookupStatus): boolean =>
  status === "planning" || status === "probing";

const byRank = (hits: readonly LookupHit[], hit: LookupHit): LookupHit[] =>
  [...hits.filter((item) => item.rank !== hit.rank), hit].toSorted(
    (a, b) => a.rank - b.rank
  );

const applyEvent = (state: LookupState, event: LookupEvent): LookupState => {
  switch (event.type) {
    case "planned": {
      return {
        ...state,
        skipped: event.skipped,
        status: "probing",
        tables: event.tables,
        total: event.probes,
      };
    }
    case "hit": {
      return {
        ...state,
        firstHit: state.firstHit ?? event.hit,
        hits: byRank(state.hits, event.hit),
      };
    }
    case "progress": {
      return { ...state, done: event.done, total: event.total };
    }
    case "probeFailed": {
      return { ...state, failed: state.failed + 1 };
    }
    case "done": {
      return {
        ...state,
        budgetExceeded: event.budgetExceeded,
        elapsedMs: event.elapsedMs,
        status: "done",
      };
    }
    case "error": {
      return event.code === "CANCELLED"
        ? { ...state, status: "cancelled" }
        : {
            ...state,
            error: { code: event.code, message: event.message },
            status: "error",
          };
    }
    default: {
      return state;
    }
  }
};

export const lookupReducer = (
  state: LookupState,
  action: LookupAction
): LookupState => {
  switch (action.type) {
    case "start": {
      return {
        ...initialLookupState,
        connectionId: action.connectionId,
        lookupId: action.lookupId,
        status: "planning",
        value: action.value,
      };
    }
    case "cancel": {
      return isSearching(state.status)
        ? { ...state, status: "cancelled" }
        : state;
    }
    default: {
      if (action.lookupId !== state.lookupId || !isSearching(state.status)) {
        return state;
      }
      return applyEvent(state, action.event);
    }
  }
};
