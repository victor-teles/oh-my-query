import type { ReactNode } from "react";

import type { Widget, WidgetDraft } from "@/lib/ipc";

import { ImportView } from "@/components/bundle/import-view";
import { WatchView } from "@/components/watches/watch-view";
import { WatchesView } from "@/components/watches/watches-view";
import { WidgetInputsView } from "@/components/widgets/widget-inputs-view";
import { WidgetRunView } from "@/components/widgets/widget-run-view";

import type { LauncherView } from "./use-launcher-stack";

import { BoardNameView } from "./views/board-name-view";
import { BoardPickerView } from "./views/board-picker-view";
import { ConnectionEditView } from "./views/connection-edit-view";
import { SettingsView } from "./views/settings-view";

export interface ViewSlots {
  root: ReactNode;
  ask: ReactNode;
  history: ReactNode;
  lookup: ReactNode;
  onBack: () => void;
  onEditInputs: (draft: WidgetDraft) => void;
  onInputsSaved: (widget: Widget, mode: "create" | "edit") => void;
  onAddToBoard: (widgetId: string) => void;
  onNewBoard: (widgetId: string) => void;
  onBoardDone: () => void;
  onImportDone: (firstWidgetId: string | null) => void;
  onWatch: (widgetId: string) => void;
  onOpenWatches: () => void;
}

export const renderView = (view: LauncherView, slots: ViewSlots) => {
  const {
    root,
    ask,
    history,
    lookup,
    onBack,
    onEditInputs,
    onInputsSaved,
    onAddToBoard,
    onNewBoard,
    onBoardDone,
    onImportDone,
    onWatch,
    onOpenWatches,
  } = slots;
  switch (view.kind) {
    case "ask": {
      return ask;
    }
    case "history": {
      return history;
    }
    case "lookup": {
      return lookup;
    }
    case "widget-run": {
      return (
        <WidgetRunView
          initialValues={view.values}
          onClose={onBack}
          onAddToBoard={onAddToBoard}
          onEditInputs={onEditInputs}
          onWatch={onWatch}
          widgetId={view.widgetId}
        />
      );
    }
    case "watch": {
      return <WatchView onBack={onBack} widgetId={view.widgetId} />;
    }
    case "watches": {
      return <WatchesView onBack={onBack} onOpenWatch={onWatch} />;
    }
    case "widget-inputs": {
      return (
        <WidgetInputsView
          draft={view.draft}
          mode={view.mode}
          onBack={onBack}
          onSaved={onInputsSaved}
        />
      );
    }
    case "board-picker": {
      return (
        <BoardPickerView
          onDone={onBoardDone}
          onNewBoard={onNewBoard}
          widgetId={view.widgetId}
        />
      );
    }
    case "board-name": {
      return (
        <BoardNameView
          onBack={onBack}
          onDone={onBoardDone}
          target={view.target}
        />
      );
    }
    case "settings": {
      return <SettingsView onBack={onBack} onOpenWatches={onOpenWatches} />;
    }
    case "connection-edit": {
      return (
        <ConnectionEditView connectionId={view.connectionId} onBack={onBack} />
      );
    }
    case "import": {
      return <ImportView onBack={onBack} onDone={onImportDone} />;
    }
    default: {
      return root;
    }
  }
};
