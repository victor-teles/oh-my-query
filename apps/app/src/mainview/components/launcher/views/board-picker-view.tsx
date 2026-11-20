import type { ChangeEvent, KeyboardEvent } from "react";

import { LayoutGridIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { tileCount } from "@/components/board/board-row";
import { useBoardList } from "@/components/board/use-board-list";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import {
  LauncherListbox,
  LauncherSection,
} from "@/components/launcher/launcher-list";
import { LauncherRow, optionId } from "@/components/launcher/launcher-row";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { getErrorMessage } from "@/lib/error-message";
import { addBoardTile, openBoard } from "@/lib/ipc";

const PICKER_LIST_ID = "launcher-board-picker";
const NEW_BOARD_ID = "new-board";

interface PickerItem {
  id: string;
  title: string;
  detail: string;
  boardId: string | null;
}

interface BoardPickerViewProps {
  widgetId: string;
  onNewBoard: (widgetId: string) => void;
  onDone: () => void;
}

export function BoardPickerView({
  widgetId,
  onNewBoard,
  onDone,
}: BoardPickerViewProps) {
  const { boards } = useBoardList();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const items: PickerItem[] = useMemo(
    () => [
      ...boards
        .filter((board) => board.name.toLowerCase().includes(needle))
        .map((board) => ({
          boardId: board.id,
          detail: board.tiles.some((tile) => tile.widgetId === widgetId)
            ? `${tileCount(board.tiles.length)} · already has this widget`
            : tileCount(board.tiles.length),
          id: board.id,
          title: board.name,
        })),
      {
        boardId: null,
        detail: "Create a board with this widget",
        id: NEW_BOARD_ID,
        title: "New Board…",
      },
    ],
    [boards, needle, widgetId]
  );
  const { move, select, selected } = useListSelection(items);

  const choose = useCallback(
    async (item: PickerItem | null | undefined) => {
      if (!item) {
        return;
      }
      if (!item.boardId) {
        onNewBoard(widgetId);
        return;
      }
      try {
        await addBoardTile(item.boardId, widgetId);
        await openBoard(item.boardId);
        onDone();
      } catch (error) {
        setError(getErrorMessage(error, "The widget could not be added."));
      }
    },
    [onDone, onNewBoard, widgetId]
  );
  const runById = useCallback(
    (id: string) => choose(items.find((item) => item.id === id)),
    [choose, items]
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      select(null);
    },
    [select]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(selected);
      }
    },
    [choose, move, selected]
  );
  const handleSubmit = useCallback(() => choose(selected), [choose, selected]);

  return (
    <div className="flex min-h-0 flex-col">
      <LauncherInput
        inputProps={{
          "aria-activedescendant": selected ? optionId(selected.id) : undefined,
          "aria-autocomplete": "list",
          "aria-controls": PICKER_LIST_ID,
          "aria-expanded": true,
          "aria-label": "Search boards",
          autoFocus: true,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: "Add to which board?",
          role: "combobox",
          value: query,
        }}
        onSubmit={handleSubmit}
      />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-panel-border pt-2">
        <LauncherListbox id={PICKER_LIST_ID} label="Boards">
          <LauncherSection label="Add to Board">
            {items.map((item) => (
              <LauncherRow
                id={item.id}
                key={item.id}
                onHover={select}
                onRun={runById}
                selected={item.id === selected?.id}
              >
                <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
                  {item.boardId ? (
                    <LayoutGridIcon aria-hidden className="size-3.5" />
                  ) : (
                    <PlusIcon aria-hidden className="size-3.5" />
                  )}
                </span>
                <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate type-body text-foreground">
                    {item.title}
                  </span>
                  <span className="truncate type-meta text-panel-muted">
                    {item.detail}
                  </span>
                </span>
              </LauncherRow>
            ))}
          </LauncherSection>
        </LauncherListbox>
        {error ? (
          <p className="px-4 pb-3 type-meta text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <LauncherFooter
        actionLabel={selected?.boardId ? "Add and Open" : "Create"}
        status={null}
      />
    </div>
  );
}
