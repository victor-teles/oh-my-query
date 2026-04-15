import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { RedisDbInfo, RedisKey, RedisScanPage } from "@/lib/tauri";

import {
  deleteRedisKey,
  redisDbInfo as fetchRedisDbInfo,
  scanRedisKeys,
} from "@/lib/tauri";

export const LARGE_KEYSPACE_THRESHOLD = 1000;
const SCAN_COUNT = 200;
const DEBOUNCE_MS = 300;

type Status =
  | "idle"
  | "db-loading"
  | "scanning"
  | "paging"
  | "gated"
  | "empty-db"
  | "loaded"
  | "error";

interface KeyspaceState {
  status: Status;
  dbInfo: RedisDbInfo | null;
  pattern: string;
  keys: RedisKey[];
  nextCursor: string;
  errorMessage: string | null;
  scanAllOverride: boolean;
}

type Action =
  | { type: "reset" }
  | { type: "db-loading" }
  | { type: "db-loaded"; payload: RedisDbInfo }
  | { type: "db-failed"; payload: string }
  | { type: "scan-start"; payload: { fresh: boolean } }
  | { type: "scan-page"; payload: RedisScanPage & { fresh: boolean } }
  | { type: "scan-failed"; payload: string }
  | { type: "set-pattern"; payload: string }
  | { type: "override-gate" }
  | { type: "remove-key"; payload: string };

export const initialKeyspaceState: KeyspaceState = {
  dbInfo: null,
  errorMessage: null,
  keys: [],
  nextCursor: "0",
  pattern: "",
  scanAllOverride: false,
  status: "db-loading",
};

export const keyspaceReducer = (
  state: KeyspaceState,
  action: Action
): KeyspaceState => {
  switch (action.type) {
    case "reset": {
      return initialKeyspaceState;
    }

    case "db-loading": {
      return { ...initialKeyspaceState, status: "db-loading" };
    }

    case "db-loaded": {
      const info = action.payload;
      if (info.totalKeys === 0) {
        return {
          ...state,
          dbInfo: info,
          keys: [],
          nextCursor: "0",
          status: "empty-db",
        };
      }
      if (
        info.totalKeys >= LARGE_KEYSPACE_THRESHOLD &&
        !state.pattern &&
        !state.scanAllOverride
      ) {
        return {
          ...state,
          dbInfo: info,
          keys: [],
          nextCursor: "0",
          status: "gated",
        };
      }
      return {
        ...state,
        dbInfo: info,
        keys: [],
        nextCursor: "0",
        status: "scanning",
      };
    }

    case "db-failed": {
      return {
        ...state,
        errorMessage: action.payload,
        status: "error",
      };
    }

    case "scan-start": {
      return {
        ...state,
        errorMessage: null,
        keys: action.payload.fresh ? [] : state.keys,
        status: action.payload.fresh ? "scanning" : "paging",
      };
    }

    case "scan-page": {
      const merged = action.payload.fresh
        ? action.payload.keys
        : [...state.keys, ...action.payload.keys];
      return {
        ...state,
        keys: merged,
        nextCursor: action.payload.nextCursor,
        status: "loaded",
      };
    }

    case "scan-failed": {
      return {
        ...state,
        errorMessage: action.payload,
        status: "error",
      };
    }

    case "set-pattern": {
      return {
        ...state,
        keys: [],
        nextCursor: "0",
        pattern: action.payload,
        scanAllOverride: false,
        status: state.dbInfo ? "scanning" : state.status,
      };
    }

    case "override-gate": {
      return {
        ...state,
        keys: [],
        nextCursor: "0",
        scanAllOverride: true,
        status: "scanning",
      };
    }

    case "remove-key": {
      return {
        ...state,
        keys: state.keys.filter((k) => k.name !== action.payload),
      };
    }

    default: {
      return state;
    }
  }
};

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Unknown error";
};

export interface UseRedisKeyspaceOptions {
  connectionId: string;
  dbIndex: number;
  isConnected: boolean;
}

export const useRedisKeyspace = ({
  connectionId,
  dbIndex,
  isConnected,
}: UseRedisKeyspaceOptions) => {
  const [state, dispatch] = useReducer(keyspaceReducer, initialKeyspaceState);
  const patternTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanToken = useRef(0);
  const dbInfoToken = useRef(0);

  const runScan = useCallback(
    async (fresh: boolean, pattern: string, cursor: string) => {
      scanToken.current += 1;
      const token = scanToken.current;
      dispatch({ payload: { fresh }, type: "scan-start" });
      try {
        const page = await scanRedisKeys({
          connectionId,
          count: SCAN_COUNT,
          cursor: fresh ? "0" : cursor,
          dbIndex,
          pattern: pattern || null,
        });
        if (token !== scanToken.current) {
          return;
        }
        dispatch({
          payload: { ...page, fresh },
          type: "scan-page",
        });
      } catch (error) {
        if (token !== scanToken.current) {
          return;
        }
        dispatch({ payload: errorMessage(error), type: "scan-failed" });
      }
    },
    [connectionId, dbIndex]
  );

  const refreshDbInfo = useCallback(async () => {
    dbInfoToken.current += 1;
    const token = dbInfoToken.current;
    dispatch({ type: "db-loading" });
    try {
      const info = await fetchRedisDbInfo(connectionId, dbIndex);
      if (token !== dbInfoToken.current) {
        return;
      }
      dispatch({ payload: info, type: "db-loaded" });
    } catch (error) {
      if (token !== dbInfoToken.current) {
        return;
      }
      dispatch({ payload: errorMessage(error), type: "db-failed" });
    }
  }, [connectionId, dbIndex]);

  useEffect(() => {
    if (!isConnected) {
      dispatch({ type: "reset" });
      return;
    }
    refreshDbInfo();
  }, [isConnected, refreshDbInfo]);

  useEffect(() => {
    if (state.status === "scanning" && state.nextCursor === "0") {
      runScan(true, state.pattern, "0");
    }
  }, [state.status, state.nextCursor, state.pattern, runScan]);

  const setPattern = useCallback((pattern: string) => {
    if (patternTimer.current !== null) {
      clearTimeout(patternTimer.current);
    }
    patternTimer.current = setTimeout(() => {
      dispatch({ payload: pattern, type: "set-pattern" });
    }, DEBOUNCE_MS);
  }, []);

  const scanAllAnyway = useCallback(() => {
    dispatch({ type: "override-gate" });
  }, []);

  const loadMore = useCallback(() => {
    if (
      state.nextCursor === "0" ||
      state.status === "scanning" ||
      state.status === "paging"
    ) {
      return;
    }
    runScan(false, state.pattern, state.nextCursor);
  }, [runScan, state.nextCursor, state.pattern, state.status]);

  const refresh = useCallback(() => {
    refreshDbInfo();
  }, [refreshDbInfo]);

  const removeKey = useCallback(
    async (name: string) => {
      await deleteRedisKey({ connectionId, dbIndex, name });
      dispatch({ payload: name, type: "remove-key" });
    },
    [connectionId, dbIndex]
  );

  const isLoading = useMemo(
    () =>
      state.status === "db-loading" ||
      state.status === "scanning" ||
      state.status === "paging",
    [state.status]
  );

  return {
    dbInfo: state.dbInfo,
    errorMessage: state.errorMessage,
    isLoading,
    keys: state.keys,
    loadMore,
    nextCursor: state.nextCursor,
    pattern: state.pattern,
    refresh,
    removeKey,
    scanAllAnyway,
    setPattern,
    status: state.status,
  };
};

export type UseRedisKeyspaceReturn = ReturnType<typeof useRedisKeyspace>;
