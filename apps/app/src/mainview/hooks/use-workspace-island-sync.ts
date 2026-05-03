import { useEffect, useMemo, useRef, useState } from "react";

import type {
  IslandSnapshot,
  RunningQueryEntry,
} from "@/contexts/island-context";
import type { DatabaseConnection } from "@/lib/connections";

import { useConnection } from "@/contexts/connection-context";
import { useIsland } from "@/contexts/island-context";
import { useQueryExecution } from "@/contexts/query-execution-context";
import { useQueryTabsContext } from "@/contexts/query-tabs-context";

const DISMISS_DELAY_SUCCESS = 3000;
const DISMISS_DELAY_ERROR = 4000;
const DISMISS_DELAY_CANCELLED = 1500;

export const useWorkspaceIslandSync = () => {
  const {
    connection,
    isConnected,
    isConnecting,
    isReconnecting,
    error: connectionError,
    serverVersion,
    reconnect,
  } = useConnection();
  const { setSnapshot } = useIsland();
  const { state: execState } = useQueryExecution();
  const { tabs, activeTabId, cancelTab } = useQueryTabsContext();
  const [dismissed, setDismissed] = useState(false);
  const [showCancelledUntil, setShowCancelledUntil] = useState(0);
  const prevStatusRef = useRef(execState.status);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runnerSignature = useMemo(
    () =>
      tabs
        .filter(
          (t) =>
            t.status === "running" &&
            t.runningQueryId &&
            t.pendingExecution?.startedAt
        )
        .map(
          (t) =>
            `${t.id}|${t.title}|${t.runningQueryId}|${t.pendingExecution?.startedAt}`
        )
        .join(","),
    [tabs]
  );

  const runners = useMemo<RunningQueryEntry[]>(() => {
    const list: RunningQueryEntry[] = [];
    for (const tab of tabs) {
      const startedAtIso = tab.pendingExecution?.startedAt;
      if (tab.status !== "running" || !tab.runningQueryId || !startedAtIso) {
        continue;
      }
      const startedAt = Date.parse(startedAtIso);
      if (!Number.isFinite(startedAt)) {
        continue;
      }
      const tabId = tab.id;
      list.push({
        connectionColor: connection.color,
        connectionEmoji: connection.emoji,
        connectionEnvironment: connection.environment,
        connectionId: connection.id,
        connectionLabel: connection.name,
        onCancel: () => cancelTab(tabId),
        startedAt,
        tabId: tab.id,
        tabTitle: tab.title,
      });
    }
    return list;
    // runnerSignature captures id/title/runningQueryId/startedAt churn so SQL edits don't re-derive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    runnerSignature,
    connection.color,
    connection.emoji,
    connection.environment,
    connection.id,
    connection.name,
    cancelTab,
  ]);

  useEffect(() => {
    if (execState.status === "running") {
      setDismissed(false);
      setShowCancelledUntil(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (cancelledTimerRef.current) {
        clearTimeout(cancelledTimerRef.current);
        cancelledTimerRef.current = null;
      }
    }
    if (prevStatusRef.current === "running" && execState.status === "idle") {
      const until = Date.now() + DISMISS_DELAY_CANCELLED;
      setShowCancelledUntil(until);
      cancelledTimerRef.current = setTimeout(
        () => setShowCancelledUntil(0),
        DISMISS_DELAY_CANCELLED
      );
    }
    prevStatusRef.current = execState.status;
  }, [execState.status]);

  useEffect(() => {
    const showCancelled = Date.now() < showCancelledUntil;
    const snapshot = resolveSnapshot({
      activeTabId,
      connection,
      connectionError,
      dismissed,
      execState,
      isConnected,
      isConnecting,
      isReconnecting,
      onReconnect: reconnect,
      runners,
      serverVersion,
      showCancelled,
    });
    setSnapshot(snapshot);

    if (snapshot.kind === "query-success") {
      timerRef.current = setTimeout(
        () => setDismissed(true),
        DISMISS_DELAY_SUCCESS
      );
    } else if (snapshot.kind === "query-error") {
      timerRef.current = setTimeout(
        () => setDismissed(true),
        DISMISS_DELAY_ERROR
      );
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    activeTabId,
    connection,
    connectionError,
    dismissed,
    execState,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnect,
    runners,
    serverVersion,
    setSnapshot,
    showCancelledUntil,
  ]);

  useEffect(
    () => () => {
      if (cancelledTimerRef.current) {
        clearTimeout(cancelledTimerRef.current);
      }
    },
    []
  );
};

interface ResolveInput {
  activeTabId: string;
  connection: DatabaseConnection;
  connectionError: string | null;
  dismissed: boolean;
  execState: ReturnType<typeof useQueryExecution>["state"];
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  onReconnect: () => void;
  runners: RunningQueryEntry[];
  serverVersion: string | null;
  showCancelled: boolean;
}

const pickHeadlineTabId = (
  runners: RunningQueryEntry[],
  activeTabId: string
): string => {
  const active = runners.find((r) => r.tabId === activeTabId);
  if (active) {
    return active.tabId;
  }
  let [oldest] = runners;
  if (!oldest) {
    return "";
  }
  for (const r of runners) {
    if (r.startedAt < oldest.startedAt) {
      oldest = r;
    }
  }
  return oldest.tabId;
};

const resolveSnapshot = ({
  activeTabId,
  connection,
  connectionError,
  dismissed,
  execState,
  isConnected,
  isConnecting,
  isReconnecting,
  onReconnect,
  runners,
  serverVersion,
  showCancelled,
}: ResolveInput): IslandSnapshot => {
  if (isReconnecting) {
    return { connectionName: connection.name, kind: "reconnecting" };
  }
  if (connectionError) {
    return { error: connectionError, kind: "connection-error", onReconnect };
  }
  if (isConnecting) {
    return { connectionName: connection.name, kind: "connecting" };
  }
  if (!isConnected) {
    return {
      color: connection.color,
      connectionName: connection.name,
      database: connection.database,
      emoji: connection.emoji,
      environment: connection.environment,
      kind: "connected-idle",
      serverVersion,
      username: connection.username,
    };
  }
  if (runners.length > 0) {
    const headlineTabId = pickHeadlineTabId(runners, activeTabId);
    const headline = runners.find((r) => r.tabId === headlineTabId);
    if (headline) {
      const onCancelAll = () => {
        for (const r of runners) {
          r.onCancel();
        }
      };
      return {
        headlineTabId,
        kind: "query-running",
        onCancelAll,
        onCancelHeadline: headline.onCancel,
        runners,
      };
    }
  }
  if (showCancelled) {
    return { kind: "query-cancelled" };
  }
  if (execState.status === "error" && execState.error && !dismissed) {
    return { error: execState.error, kind: "query-error" };
  }
  if (execState.status === "success" && execState.result && !dismissed) {
    const rowCount =
      execState.result.resultType === "tabular"
        ? execState.result.rowCount
        : execState.result.count;
    return {
      executionTimeMs: execState.result.executionTimeMs,
      kind: "query-success",
      rowCount,
    };
  }
  return {
    color: connection.color,
    connectionName: connection.name,
    database: connection.database,
    emoji: connection.emoji,
    environment: connection.environment,
    kind: "connected-idle",
    serverVersion,
    username: connection.username,
  };
};
