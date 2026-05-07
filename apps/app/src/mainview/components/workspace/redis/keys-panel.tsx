import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { RedisKey } from "@/lib/tauri";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnection } from "@/contexts/connection-context";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import {
  redisInspectCommand,
  redisTtlCommand,
  redisTypeCommand,
} from "@/lib/redis-templates";
import { cn } from "@/lib/utils";

import { DeleteKeyDialog } from "./delete-key-dialog";
import { KeysEmptyState } from "./keys-empty-state";
import { KeysErrorState } from "./keys-error-state";
import { KeysGateBanner } from "./keys-gate-banner";
import { KeysNamespaceTree } from "./keys-namespace-tree";
import { KeysPanelHeader } from "./keys-panel-header";
import { KeysStatusFooter } from "./keys-status-footer";
import {
  buildNamespaceTree,
  defaultExpansion,
  visibleRowsInOrder,
} from "./namespace";
import { useRedisKeyboard } from "./use-redis-keyboard";
import { useRedisKeyspace } from "./use-redis-keyspace";

interface KeysPanelProps {
  connection: DatabaseConnection;
  dbIndex: number;
  onSelectDb: (dbIndex: number) => void;
  isActiveTab: boolean;
}

const SKELETON_ROWS = [
  { id: "s1", width: "w-5/6" },
  { id: "s2", width: "w-2/3" },
  { id: "s3", width: "w-3/4" },
  { id: "s4", width: "w-1/2" },
  { id: "s5", width: "w-2/5" },
];

const KeysLoadingSkeleton = () => (
  <div className="flex flex-col gap-1.5 px-2 py-3">
    {SKELETON_ROWS.map((row) => (
      <div className="flex items-center gap-2" key={row.id}>
        <Skeleton className="h-[18px] w-[44px] rounded-sm" />
        <Skeleton className={cn("h-4", row.width)} />
      </div>
    ))}
  </div>
);

export const KeysPanel = ({
  connection,
  dbIndex,
  onSelectDb,
  isActiveTab,
}: KeysPanelProps) => {
  const { openQueryAndRun } = useEditorInsert();
  const { isConnected } = useConnection();

  const {
    dbInfo,
    errorMessage,
    isLoading,
    keys,
    loadMore,
    nextCursor,
    pattern,
    refresh,
    removeKey,
    scanAllAnyway,
    setPattern,
    status,
  } = useRedisKeyspace({
    connectionId: connection.id,
    dbIndex,
    isConnected,
  });

  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [patternFocusKey, setPatternFocusKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<RedisKey | null>(null);

  const root = useMemo(() => buildNamespaceTree(keys), [keys]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const appliedDefaultsForRoot = useRef<typeof root | null>(null);

  useEffect(() => {
    if (keys.length === 0) {
      return;
    }
    if (appliedDefaultsForRoot.current === root) {
      return;
    }
    appliedDefaultsForRoot.current = root;
    setExpanded(defaultExpansion(root));
  }, [keys, root]);

  const visibleRows = useMemo(
    () => visibleRowsInOrder(root, expanded),
    [root, expanded]
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeRowId || !scrollContainerRef.current) {
      return;
    }
    const selector = `[data-row-id="${CSS.escape(activeRowId)}"]`;
    const el = scrollContainerRef.current.querySelector<HTMLElement>(selector);
    el?.scrollIntoView({ block: "nearest" });
    el?.focus({ preventScroll: true });
  }, [activeRowId]);

  useEffect(() => {
    if (!activeRowId) {
      return;
    }
    const exists = visibleRows.some((r) => r.id === activeRowId);
    if (!exists) {
      setActiveRowId(null);
    }
  }, [activeRowId, visibleRows]);

  useEffect(() => {
    if (status === "gated") {
      setPatternFocusKey((n) => n + 1);
    }
  }, [status]);

  const handleToggle = useCallback((fullName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  }, []);

  const handleInspect = useCallback(
    (key: RedisKey) => {
      setActiveRowId(key.name);
      openQueryAndRun(redisInspectCommand(key.name, key.kind));
    },
    [openQueryAndRun]
  );

  const handleCheckTtl = useCallback(
    (key: RedisKey) => {
      openQueryAndRun(redisTtlCommand(key.name));
    },
    [openQueryAndRun]
  );

  const handleCheckType = useCallback(
    (key: RedisKey) => {
      openQueryAndRun(redisTypeCommand(key.name));
    },
    [openQueryAndRun]
  );

  const handleCopyName = useCallback((key: RedisKey) => {
    navigator.clipboard.writeText(key.name);
  }, []);

  const handleRequestDelete = useCallback((key: RedisKey) => {
    setPendingDelete(key);
  }, []);

  const handleConfirmDelete = useCallback(
    async (name: string) => {
      await removeKey(name);
      if (activeRowId === name) {
        setActiveRowId(null);
      }
    },
    [removeKey, activeRowId]
  );

  const handleActivateKey = useCallback(
    (name: string) => {
      const key = keys.find((k) => k.name === name);
      if (key) {
        handleInspect(key);
      }
    },
    [keys, handleInspect]
  );

  const handleRunStarter = useCallback(() => {
    openQueryAndRun("SET hello world");
    setTimeout(() => {
      refresh();
    }, 400);
  }, [openQueryAndRun, refresh]);

  const focusPattern = useCallback(() => {
    setPatternFocusKey((n) => n + 1);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setPendingDelete(null);
  }, []);

  useRedisKeyboard({
    activeRowId,
    enabled: isActiveTab,
    expanded,
    onActiveChange: setActiveRowId,
    onFocusPattern: focusPattern,
    onRefresh: refresh,
    onSelectDb,
    onToggleFolder: handleToggle,
    rows: visibleRows,
  });

  const total = dbInfo?.totalKeys ?? null;
  const showStatusFooter = status === "loaded" || status === "paging";

  return (
    <>
      <div ref={scrollContainerRef} className="flex h-full min-h-0 flex-col">
        <KeysPanelHeader
          dbIndex={dbIndex}
          isLoading={isLoading}
          onPatternChange={setPattern}
          onRefresh={refresh}
          onSelectDb={onSelectDb}
          patternFocusKey={patternFocusKey}
          totalKeys={total}
        />

        <ScrollArea className="min-h-0 flex-1">
          {status === "db-loading" && <KeysLoadingSkeleton />}
          {status === "scanning" && keys.length === 0 && (
            <KeysLoadingSkeleton />
          )}
          {status === "gated" && dbInfo && (
            <KeysGateBanner
              onScanAll={scanAllAnyway}
              totalKeys={dbInfo.totalKeys}
            />
          )}
          {status === "empty-db" && (
            <KeysEmptyState
              onRunStarter={handleRunStarter}
              variant="empty-db"
            />
          )}
          {status === "loaded" && keys.length === 0 && pattern && (
            <KeysEmptyState pattern={pattern} variant="no-match" />
          )}
          {status === "error" && errorMessage && (
            <KeysErrorState message={errorMessage} onRetry={refresh} />
          )}
          {keys.length > 0 && (
            <div className="p-1">
              <KeysNamespaceTree
                actions={{
                  onCheckTtl: handleCheckTtl,
                  onCheckType: handleCheckType,
                  onCopyName: handleCopyName,
                  onInspect: handleInspect,
                  onRequestDelete: handleRequestDelete,
                }}
                activeRowId={activeRowId}
                expanded={expanded}
                onActivateKey={handleActivateKey}
                onToggle={handleToggle}
                root={root}
              />
            </div>
          )}
        </ScrollArea>

        {showStatusFooter && (
          <KeysStatusFooter
            isLoading={isLoading}
            nextCursor={nextCursor}
            onLoadMore={loadMore}
            shown={keys.length}
            total={total}
          />
        )}
      </div>

      <DeleteKeyDialog
        dbIndex={dbIndex}
        onClose={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
        redisKey={pendingDelete}
      />
    </>
  );
};
