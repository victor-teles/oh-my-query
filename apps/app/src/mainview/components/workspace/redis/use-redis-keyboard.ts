import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback } from "react";

import type { VisibleRow } from "./namespace";

import { findParentFullName } from "./namespace";

interface UseRedisKeyboardOptions {
  rows: VisibleRow[];
  activeRowId: string | null;
  expanded: Set<string>;
  onActiveChange: (id: string | null) => void;
  onToggleFolder: (fullName: string) => void;
  onFocusPattern: () => void;
  onSelectDb: (dbIndex: number) => void;
  onRefresh: () => void;
  enabled: boolean;
}

export const useRedisKeyboard = ({
  rows,
  activeRowId,
  expanded,
  onActiveChange,
  onToggleFolder,
  onFocusPattern,
  onSelectDb,
  onRefresh,
  enabled,
}: UseRedisKeyboardOptions) => {
  const moveActive = useCallback(
    (delta: number) => {
      if (rows.length === 0) {
        return;
      }
      const currentIdx = activeRowId
        ? rows.findIndex((r) => r.id === activeRowId)
        : -1;
      let nextIdx: number;
      if (currentIdx < 0) {
        nextIdx = delta > 0 ? 0 : rows.length - 1;
      } else {
        nextIdx = Math.min(Math.max(currentIdx + delta, 0), rows.length - 1);
      }
      const target = rows[nextIdx];
      if (target) {
        onActiveChange(target.id);
      }
    },
    [rows, activeRowId, onActiveChange]
  );

  const findActiveRow = useCallback(
    (): VisibleRow | undefined => rows.find((r) => r.id === activeRowId),
    [rows, activeRowId]
  );

  useHotkey(
    "ArrowDown",
    (event) => {
      event.preventDefault();
      moveActive(1);
    },
    { enabled }
  );

  useHotkey(
    "ArrowUp",
    (event) => {
      event.preventDefault();
      moveActive(-1);
    },
    { enabled }
  );

  useHotkey(
    "ArrowLeft",
    (event) => {
      const row = findActiveRow();
      if (!row) {
        return;
      }
      event.preventDefault();
      if (row.kind === "folder") {
        if (expanded.has(row.id)) {
          onToggleFolder(row.id);
          return;
        }
        const parent = findParentFullName(row.id);
        if (parent) {
          onActiveChange(parent);
        }
        return;
      }
      const parent = findParentFullName(row.node.fullName);
      if (!parent) {
        return;
      }
      const parentRowExists = rows.some(
        (r) => r.kind === "folder" && r.id === parent
      );
      if (parentRowExists) {
        onActiveChange(parent);
        if (expanded.has(parent)) {
          onToggleFolder(parent);
        }
      }
    },
    { enabled }
  );

  useHotkey(
    "ArrowRight",
    (event) => {
      const row = findActiveRow();
      if (!row || row.kind !== "folder") {
        return;
      }
      event.preventDefault();
      if (expanded.has(row.id)) {
        const idx = rows.findIndex((r) => r.id === row.id);
        const next = rows[idx + 1];
        if (next) {
          onActiveChange(next.id);
        }
      } else {
        onToggleFolder(row.id);
      }
    },
    { enabled }
  );

  useHotkey(
    "/",
    (event) => {
      event.preventDefault();
      onFocusPattern();
    },
    { enabled }
  );

  useHotkey(
    "F5",
    () => {
      onRefresh();
    },
    { enabled }
  );

  useHotkey(
    "Escape",
    () => {
      if (activeRowId) {
        onActiveChange(null);
      }
    },
    { enabled }
  );

  useHotkey(
    "Mod+1",
    (e) => {
      e.preventDefault();
      onSelectDb(0);
    },
    { enabled }
  );
  useHotkey(
    "Mod+2",
    (e) => {
      e.preventDefault();
      onSelectDb(1);
    },
    { enabled }
  );
  useHotkey(
    "Mod+3",
    (e) => {
      e.preventDefault();
      onSelectDb(2);
    },
    { enabled }
  );
  useHotkey(
    "Mod+4",
    (e) => {
      e.preventDefault();
      onSelectDb(3);
    },
    { enabled }
  );
  useHotkey(
    "Mod+5",
    (e) => {
      e.preventDefault();
      onSelectDb(4);
    },
    { enabled }
  );
  useHotkey(
    "Mod+6",
    (e) => {
      e.preventDefault();
      onSelectDb(5);
    },
    { enabled }
  );
  useHotkey(
    "Mod+7",
    (e) => {
      e.preventDefault();
      onSelectDb(6);
    },
    { enabled }
  );
  useHotkey(
    "Mod+8",
    (e) => {
      e.preventDefault();
      onSelectDb(7);
    },
    { enabled }
  );
  useHotkey(
    "Mod+9",
    (e) => {
      e.preventDefault();
      onSelectDb(8);
    },
    { enabled }
  );
};
