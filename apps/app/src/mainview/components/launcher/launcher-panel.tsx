import { AnimatePresence } from "motion/react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Board,
  LauncherNavigateView,
  LookupValue,
  ParamValues,
  Widget,
  WidgetDraft,
} from "@/lib/ipc";

import { AskView } from "@/components/ask/ask-view";
import { HistoryView } from "@/components/history/history-view";
import { LookupView } from "@/components/lookup/lookup-view";
import { WatchesProvider } from "@/components/watches/watches-provider";
import {
  useWidgets,
  WidgetsProvider,
} from "@/components/widgets/widgets-provider";
import { onLauncherNavigate, openBoard } from "@/lib/ipc";
import { useMotionPreset } from "@/lib/motion";

import { ConnectionsProvider } from "./connections/connections-provider";
import { LauncherSurface } from "./launcher-surface";
import { renderView } from "./render-launcher-view";
import { stackVariants } from "./stack-variants";
import { StackViewFrame } from "./stack-view-frame";
import { useLauncherAccelerator } from "./use-launcher-accelerator";
import { useLauncherAsk } from "./use-launcher-ask";
import { useLauncherHotkeys } from "./use-launcher-hotkeys";
import { useLauncherLookup } from "./use-launcher-lookup";
import { useLauncherPresence } from "./use-launcher-presence";
import { useLauncherStack } from "./use-launcher-stack";
import { RootView } from "./views/root-view";

export const RESET_AFTER_HIDDEN_MS = 60_000;
const SETTINGS = { kind: "settings" } as const;
const HISTORY = { kind: "history" } as const;
const IMPORT = { kind: "import" } as const;
const WATCHES = { kind: "watches" } as const;

export function LauncherPanel() {
  return (
    <ConnectionsProvider>
      <WidgetsProvider>
        <WatchesProvider>
          <LauncherStackView />
        </WatchesProvider>
      </WidgetsProvider>
    </ConnectionsProvider>
  );
}

function LauncherStackView() {
  const stack = useLauncherStack();
  const { markFresh, refresh: refreshWidgets } = useWidgets();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const preset = useMotionPreset();

  const [clipboardOffer, setClipboardOffer] = useState<LookupValue | null>(
    null
  );
  const { presence, dismiss, onPresenceSettled } = useLauncherPresence({
    onHidden: () => setClipboardOffer(null),
    onShown: (hiddenForMs, shown) => {
      setClipboardOffer(shown.clipboard ?? null);
      if (hiddenForMs > RESET_AFTER_HIDDEN_MS) {
        stack.reset();
        setQuery("");
      }
      inputRef.current?.focus();
    },
  });

  const { push, pop: handleBack } = stack;
  const { openMatch, rootAsk, session } = useLauncherAsk(push);
  const {
    openRows: handleOpenRows,
    root: rootLookup,
    session: lookupSession,
  } = useLauncherLookup({
    offer: clipboardOffer,
    openMatch,
    push,
  });
  const hotkey = useLauncherAccelerator();
  const handleOpenSettings = useCallback(() => push(SETTINGS), [push]);
  const handleEditConnection = useCallback(
    (connectionId: string | null) =>
      push({ connectionId, kind: "connection-edit" }),
    [push]
  );
  const handleClearQuery = useCallback(() => setQuery(""), []);
  const handleRunWidget = useCallback(
    (widgetId: string, values: ParamValues = {}) =>
      push({ kind: "widget-run", values, widgetId }),
    [push]
  );
  const handleReviewInputs = useCallback(
    (draft: WidgetDraft) =>
      push({ draft, kind: "widget-inputs", mode: "create" }),
    [push]
  );
  const handleEditInputs = useCallback(
    (draft: WidgetDraft) =>
      push({ draft, kind: "widget-inputs", mode: "edit" }),
    [push]
  );
  const { reset } = stack;
  const handleInputsSaved = useCallback(
    (widget: Widget, mode: "create" | "edit") => {
      if (mode === "edit") {
        handleBack();
        return;
      }
      markFresh(widget.id);
      setQuery("");
      reset();
    },
    [handleBack, markFresh, reset]
  );
  const handleAddToBoard = useCallback(
    (widgetId: string) => push({ kind: "board-picker", widgetId }),
    [push]
  );
  const handleWatch = useCallback(
    (widgetId: string) => push({ kind: "watch", widgetId }),
    [push]
  );
  const handleOpenWatches = useCallback(() => push(WATCHES), [push]);
  const handleNewBoard = useCallback(
    (widgetId: string | null) =>
      push({
        kind: "board-name",
        target: { addWidgetId: widgetId, boardId: null, initialName: "" },
      }),
    [push]
  );
  const handleBoardDone = useCallback(() => {
    setQuery("");
    reset();
  }, [reset]);
  const handleImportDone = useCallback(
    async (firstWidgetId: string | null) => {
      await refreshWidgets();
      markFresh(firstWidgetId);
      handleBoardDone();
    },
    [handleBoardDone, markFresh, refreshWidgets]
  );
  const handleOpenBoard = useCallback(
    async (boardId: string) => {
      try {
        await openBoard(boardId);
        handleBoardDone();
      } catch (error) {
        console.error("[launcher] could not open the board", error);
      }
    },
    [handleBoardDone]
  );
  const navigation = useMemo(
    () => ({
      addToBoard: handleAddToBoard,
      dismiss,
      editConnection: handleEditConnection,
      newBoard: () => handleNewBoard(null),
      openBoard: handleOpenBoard,
      openHistory: () => push(HISTORY),
      openImport: () => push(IMPORT),
      openSettings: handleOpenSettings,
      renameBoard: (board: Board) =>
        push({
          kind: "board-name",
          target: {
            addWidgetId: null,
            boardId: board.id,
            initialName: board.name,
          },
        }),
      runWidget: handleRunWidget,
      watchWidget: handleWatch,
    }),
    [
      dismiss,
      handleAddToBoard,
      handleEditConnection,
      handleNewBoard,
      handleOpenBoard,
      handleOpenSettings,
      handleRunWidget,
      handleWatch,
      push,
    ]
  );

  useLauncherHotkeys({
    depth: stack.depth,
    hotkey,
    onClearQuery: handleClearQuery,
    onDismiss: dismiss,
    onOpenSettings: handleOpenSettings,
    onPop: handleBack,
    query,
  });

  const handleNavigate = useEffectEvent((view: LauncherNavigateView) => {
    if (view === "settings") {
      stack.push(SETTINGS);
      return;
    }
    stack.reset();
    if (view === "watches") {
      stack.push(WATCHES);
    } else if (typeof view === "object") {
      stack.push({ kind: "widget-run", values: {}, widgetId: view.widgetId });
    }
  });

  useEffect(() => onLauncherNavigate(handleNavigate), []);

  const viewVariants = stackVariants(preset);

  return (
    <LauncherSurface onPresenceSettled={onPresenceSettled} presence={presence}>
      <AnimatePresence
        custom={stack.direction}
        initial={false}
        mode="popLayout"
      >
        <StackViewFrame
          direction={stack.direction}
          key={stack.current.kind}
          variants={viewVariants}
        >
          {renderView(stack.current, {
            ask: (
              <AskView
                inputRef={inputRef}
                onAddToBoard={handleAddToBoard}
                onOpenSettings={handleOpenSettings}
                onReviewInputs={handleReviewInputs}
                onRunWidget={handleRunWidget}
                session={session}
              />
            ),
            history: <HistoryView ask={rootAsk} inputRef={inputRef} />,
            lookup: (
              <LookupView
                inputRef={inputRef}
                onOpenRows={handleOpenRows}
                session={lookupSession}
              />
            ),
            onAddToBoard: handleAddToBoard,
            onBack: handleBack,
            onBoardDone: handleBoardDone,
            onEditInputs: handleEditInputs,
            onImportDone: handleImportDone,
            onInputsSaved: handleInputsSaved,
            onNewBoard: handleNewBoard,
            onOpenWatches: handleOpenWatches,
            onWatch: handleWatch,
            root: (
              <RootView
                ask={rootAsk}
                inputRef={inputRef}
                lookup={rootLookup}
                navigate={navigation}
                onQueryChange={setQuery}
                query={query}
              />
            ),
          })}
        </StackViewFrame>
      </AnimatePresence>
    </LauncherSurface>
  );
}
