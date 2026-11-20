import type { ChangeEvent, KeyboardEvent } from "react";

import { REFRESH_INTERVALS, RefreshInterval } from "@oh-my-query/rpc";
import { PencilRulerIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useState } from "react";

import type { Board } from "@/lib/ipc";

import { KeyCombo } from "@/components/launcher/key-combo";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { cn } from "@/lib/utils";

import { updatedLabel } from "./board-inputs";
import { useNow } from "./use-now";

const NO_DRAG = "electrobun-webkit-app-region-no-drag";
const MINUTE = 60_000;

const REFRESH_LABELS: Record<RefreshInterval, string> = {
  "15m": "Every 15 minutes",
  "1h": "Every hour",
  "1m": "Every minute",
  "5m": "Every 5 minutes",
  off: "Manual refresh",
};

export interface BoardHeaderActions {
  onRename: (name: string) => void;
  onRefreshInterval: (refresh: RefreshInterval) => void;
  onRefresh: () => void;
  onToggleEdit: () => void;
}

interface BoardNameProps {
  board: Board;
  editing: boolean;
  onRename: (name: string) => void;
}

function BoardName({ board, editing, onRename }: BoardNameProps) {
  const [draft, setDraft] = useState(board.name);
  const commit = useCallback(() => {
    const name = draft.trim();
    if (name && name !== board.name) {
      onRename(name);
    } else {
      setDraft(board.name);
    }
  }, [board.name, draft, onRename]);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    []
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    []
  );

  if (!editing) {
    return (
      <h1 className="truncate type-title text-[15px] text-foreground">
        {board.emoji ? `${board.emoji} ` : ""}
        {board.name}
      </h1>
    );
  }
  return (
    <input
      aria-label="Board name"
      className={cn(
        NO_DRAG,
        "h-8 w-64 rounded-[8px] bg-row-hover px-2.5 type-title text-[15px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      )}
      maxLength={60}
      onBlur={commit}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      value={draft}
    />
  );
}

interface BoardHeaderProps {
  board: Board;
  editing: boolean;
  updatedAt: number | null;
  actions: BoardHeaderActions;
}

export function BoardHeader({
  board,
  editing,
  updatedAt,
  actions,
}: BoardHeaderProps) {
  const now = useNow(MINUTE / 4);
  const { onRefresh, onRefreshInterval, onRename, onToggleEdit } = actions;
  const handleInterval = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      onRefreshInterval(RefreshInterval.parse(event.target.value)),
    [onRefreshInterval]
  );

  return (
    <header className="electrobun-webkit-app-region-drag flex h-[52px] shrink-0 items-center gap-3 border-b border-panel-border pr-4 pl-[84px]">
      <BoardName
        board={board}
        editing={editing}
        key={board.name}
        onRename={onRename}
      />
      <span
        aria-live="polite"
        className="type-meta text-panel-muted tabular-nums"
      >
        <SwapText value={updatedLabel(updatedAt, now)} />
      </span>
      <div className={cn(NO_DRAG, "ml-auto flex items-center gap-1.5")}>
        <select
          aria-label="Refresh"
          className="h-7 rounded-[7px] bg-row-hover px-2 type-meta text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          onChange={handleInterval}
          value={board.refresh}
        >
          {REFRESH_INTERVALS.map((interval) => (
            <option key={interval} value={interval}>
              {REFRESH_LABELS[interval]}
            </option>
          ))}
        </select>
        <Pressable
          aria-keyshortcuts="Meta+R"
          aria-label="Refresh now"
          className="flex h-7 items-center gap-1.5 rounded-[7px] px-2 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground"
          onClick={onRefresh}
        >
          <RotateCwIcon aria-hidden className="size-3.5" />
          <KeyCombo keys={["⌘", "R"]} />
        </Pressable>
        <Pressable
          aria-keyshortcuts="Meta+E"
          aria-pressed={editing}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-[7px] px-2 type-meta hover:bg-row-hover",
            editing
              ? "bg-row-active text-foreground"
              : "text-panel-muted hover:text-foreground"
          )}
          onClick={onToggleEdit}
        >
          <PencilRulerIcon aria-hidden className="size-3.5" />
          {editing ? "Done" : "Edit"}
          <KeyCombo keys={["⌘", "E"]} />
        </Pressable>
      </div>
    </header>
  );
}
