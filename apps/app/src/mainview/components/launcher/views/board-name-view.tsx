import type { ChangeEvent, KeyboardEvent } from "react";

import { draftOf, emptyBoard } from "@oh-my-query/rpc";
import { useCallback, useState } from "react";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { getErrorMessage } from "@/lib/error-message";
import { addBoardTile, getBoard, openBoard, saveBoard } from "@/lib/ipc";

export interface BoardNameTarget {
  boardId: string | null;
  initialName: string;
  addWidgetId: string | null;
}

interface BoardNameViewProps {
  target: BoardNameTarget;
  onBack: () => void;
  onDone: () => void;
}

const saveName = async (
  { boardId, addWidgetId }: BoardNameTarget,
  name: string
) => {
  if (boardId) {
    const board = await getBoard(boardId);
    if (!board) {
      throw new Error("This board no longer exists.");
    }
    await saveBoard({ ...draftOf(board), name });
    return;
  }
  const board = await saveBoard(emptyBoard(name));
  if (addWidgetId) {
    await addBoardTile(board.id, addWidgetId);
  }
  await openBoard(board.id);
};

const footerLabel = (saving: boolean, creating: boolean) => {
  if (saving) {
    return "Saving…";
  }
  return creating ? "Create and Open" : "Rename";
};

export function BoardNameView({ target, onBack, onDone }: BoardNameViewProps) {
  const [name, setName] = useState(target.initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const creating = target.boardId === null;

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the board a name.");
      return;
    }
    setSaving(true);
    try {
      await saveName(target, trimmed);
      onDone();
    } catch (error) {
      setError(getErrorMessage(error, "The board could not be saved."));
      setSaving(false);
    }
  }, [name, onDone, target]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    setError(null);
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <div className="flex min-h-0 flex-col">
      <ViewHeader
        onBack={onBack}
        title={creating ? "New Board" : "Rename Board"}
      />
      <div className="flex flex-col gap-2 border-t border-panel-border px-4 py-4">
        <label className="flex items-center gap-3">
          <span className="w-12 shrink-0 type-meta text-panel-muted">Name</span>
          <input
            aria-label="Board name"
            autoFocus
            className="h-9 min-w-0 flex-1 rounded-[8px] bg-row-hover px-3 type-body text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            maxLength={60}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Morning metrics"
            spellCheck={false}
            value={name}
          />
        </label>
        {error ? (
          <p className="pl-15 type-meta text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <LauncherFooter
        actionLabel={footerLabel(saving, creating)}
        status={null}
      />
    </div>
  );
}
