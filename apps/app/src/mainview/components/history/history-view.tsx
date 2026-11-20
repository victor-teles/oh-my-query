import type { ChangeEvent, RefObject } from "react";

import { AnimatePresence } from "motion/react";
import { useCallback, useState } from "react";

import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { LauncherInput } from "@/components/launcher/launcher-input";
import { optionId } from "@/components/launcher/launcher-row";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useMotionPreset } from "@/lib/motion";

import type { HistoryAskActions } from "./use-history-commands";

import { historyActions } from "./history-actions";
import { HistoryFooter } from "./history-footer";
import { HISTORY_LIST_ID, HistoryList } from "./history-list";
import { HistoryNameField } from "./history-name-field";
import { clearOutMs } from "./history-row";
import { useHistory } from "./use-history";
import { useHistoryCommands } from "./use-history-commands";
import { useHistoryKeyboard } from "./use-history-keyboard";
import { useHistoryMenu } from "./use-history-menu";
import { useHistoryResults } from "./use-history-results";
import { useSelectedInView } from "./use-selected-in-view";

interface HistoryViewProps {
  ask: HistoryAskActions;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function HistoryView({ ask, inputRef }: HistoryViewProps) {
  const { reduced } = useMotionPreset();
  const history = useHistory({ clearOutMs: clearOutMs(reduced) });
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState(false);
  const { connections, items, now, sections } = useHistoryResults(
    history.asks,
    query
  );
  const { move, select, selected } = useListSelection(items);
  useSelectedInView(selected?.id ?? null);

  const commands = useHistoryCommands({
    ask,
    connections,
    history,
    items,
    select,
    selected,
  });
  const focusInput = useCallback(() => inputRef.current?.focus(), [inputRef]);
  const menu = useHistoryMenu({
    canOpen: selected !== null,
    commands,
    focusInput,
  });
  const handleKeyDown = useHistoryKeyboard({
    commands,
    move,
    onToggleMenu: menu.toggle,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setTyped(true);
    select(null);
  };
  const { askAgain: handleSubmit, target, language } = commands;
  const actions = historyActions(target, language);
  const { close: handleCloseMenu, run: handleRunAction } = menu;
  const { retry: handleRetry } = history;

  return (
    <div className="flex min-h-0 flex-col">
      <LauncherInput
        inputProps={{
          "aria-activedescendant": selected ? optionId(selected.id) : undefined,
          "aria-autocomplete": "list",
          "aria-controls": HISTORY_LIST_ID,
          "aria-expanded": items.length > 0,
          "aria-label": "Search history",
          autoFocus: true,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: "Search past asks…",
          ref: inputRef,
          role: "combobox",
          value: query,
        }}
        onSubmit={handleSubmit}
      />
      <HistoryNameField onDone={focusInput} save={commands.save} />
      <div
        className="relative flex min-h-0 flex-1 flex-col border-t border-panel-border"
        style={{ minHeight: menu.open ? actionsMenuHeight(actions.length) : 0 }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto pt-2">
          <HistoryList
            motion={{ clearing: history.clearing, intro: !typed }}
            onRetry={handleRetry}
            rows={{
              now,
              onHover: select,
              onRun: commands.askById,
              selectedId: selected?.id ?? null,
            }}
            view={{
              query,
              sections,
              status: history.status,
              total: history.asks.length,
            }}
          />
        </div>
        <AnimatePresence>
          {menu.open && selected ? (
            <ActionsMenu
              actions={actions}
              anchorId={optionId(selected.id)}
              armedId={menu.armed ? "clear" : null}
              key={selected.id}
              onClose={handleCloseMenu}
              onRun={handleRunAction}
              title={selected.entry.ask.prompt}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <HistoryFooter
        hasSelection={selected !== null}
        status={commands.status}
        target={target}
      />
    </div>
  );
}
