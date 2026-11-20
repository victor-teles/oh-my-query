import type { ChangeEvent, RefObject } from "react";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { ConnectionAction } from "@/components/launcher/connections/connection-actions";
import type { RootAlert } from "@/components/watches/use-alerts";
import type { LookupValue, ParamValues, Watch } from "@/lib/ipc";

import { useBoardList } from "@/components/board/use-board-list";
import { useExport } from "@/components/bundle/use-export";
import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { ActiveConnectionChip } from "@/components/launcher/connections/active-connection-chip";
import { connectionActions } from "@/components/launcher/connections/connection-actions";
import { ConnectionActionsMenu } from "@/components/launcher/connections/connection-actions-menu";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { useConnectionActionsMenu } from "@/components/launcher/connections/use-connection-actions-menu";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import { optionId } from "@/components/launcher/launcher-row";
import { ModeBadge } from "@/components/launcher/mode-badge";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useAlerts } from "@/components/watches/use-alerts";
import {
  useWatches,
  watchForWidget,
} from "@/components/watches/watches-provider";
import { PILL_POPOVER_SPACE } from "@/components/widgets/arguments/pill-popover";
import { WidgetArgumentsRow } from "@/components/widgets/arguments/widget-arguments-row";
import { useWidgets } from "@/components/widgets/widgets-provider";

import type { CatalogItem } from "./catalog-actions";
import type { RootItem } from "./root-items";
import type { CatalogNavigation } from "./use-catalog-menu";

import {
  armedRowId,
  catalogActions,
  catalogTitle,
  isCatalogItem,
} from "./catalog-actions";
import { RootBody } from "./root-body";
import { widgetItemId } from "./root-items";
import { ROOT_LIST_ID } from "./root-list";
import { RootStatus } from "./root-status";
import { useCatalogMenu } from "./use-catalog-menu";
import { useConnectionToken } from "./use-connection-token";
import { useRootArguments } from "./use-root-arguments";
import {
  footerFor,
  LAST_ANSWER_HINT,
  useRootKeyboard,
} from "./use-root-keyboard";
import { useRootRun } from "./use-root-run";
import { useRootSections } from "./use-root-sections";

const catalogMenuFor = (
  item: CatalogItem | null,
  watches: readonly Watch[]
) => {
  if (!item) {
    return [];
  }
  const watch =
    item.kind === "widget" ? watchForWidget(watches, item.widget.id) : null;
  return catalogActions(item, watch);
};
const PLACEHOLDER = "Search or ask… > SQL · # table · @ connection";

export interface RootAskActions {
  start: (prompt: string, target: AskTarget) => void;
  startSql: (sql: string, target: AskTarget, title?: string) => void;
  reopen: (() => void) | null;
}

export interface RootLookup {
  offer: LookupValue | null;
  start: (value: LookupValue, connectionId: string) => void;
}

export interface RootNavigation extends Omit<
  CatalogNavigation,
  "runWidget" | "exportScope"
> {
  openSettings: () => void;
  openHistory: () => void;
  openImport: () => void;
  dismiss: () => void;
  editConnection: (connectionId: string | null) => void;
  runWidget: (widgetId: string, values: ParamValues) => void;
  newBoard: () => void;
}

interface RootViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  navigate: RootNavigation;
  ask: RootAskActions;
  lookup: RootLookup;
}

export function RootView({
  query,
  onQueryChange,
  inputRef,
  navigate,
  ask,
  lookup,
}: RootViewProps) {
  const connections = useConnections();
  const { state, activate } = connections;
  const { widgets, freshId, refresh } = useWidgets();
  const { watches } = useWatches();
  const { acknowledge } = useAlerts();
  const { boards, reload: reloadBoards } = useBoardList();
  const args = useRootArguments(widgets);
  const { editConnection: onEditConnection, openBoard, runWidget } = navigate;
  const {
    outcome: exportOutcome,
    reveal: handleReveal,
    run: exportScope,
  } = useExport();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const commandNavigation = useMemo(
    () => ({ ...navigate, exportAll: () => exportScope({ kind: "all" }) }),
    [exportScope, navigate]
  );
  const view = useRootSections({
    boards,
    navigate: commandNavigation,
    offer: lookup.offer,
    query,
  });
  const { input, items } = view;
  const { mode } = input;
  const { move, select, selected } = useListSelection(
    items,
    freshId ? widgetItemId(freshId) : state.focusId
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), [inputRef]);
  const menu = useConnectionActionsMenu({
    onClosed: focusInput,
    onEdit: onEditConnection,
  });
  const catalogNavigation = useMemo(
    () => ({
      ...navigate,
      exportScope,
      runWidget: (widgetId: string) => runWidget(widgetId, {}),
    }),
    [exportScope, navigate, runWidget]
  );
  const catalog = useCatalogMenu({
    navigate: catalogNavigation,
    onChanged: reloadBoards,
    onClosed: focusInput,
  });
  const { open: openConnectionMenu } = menu;
  const {
    close: handleCloseCatalog,
    open: openCatalogMenu,
    run: handleRunCatalogAction,
  } = catalog;
  const openActions = useCallback(
    (item: RootItem) => {
      if (item.kind === "connection") {
        openConnectionMenu(item.connection.id);
      } else if (isCatalogItem(item)) {
        openCatalogMenu(item);
      }
    },
    [openCatalogMenu, openConnectionMenu]
  );

  const token = useConnectionToken({
    activate,
    connections: state.connections,
    mode,
    onQueryChange,
  });
  const dismissAlert = useCallback(
    (alert: RootAlert) => acknowledge(alert.watchId),
    [acknowledge]
  );
  const openAlert = useCallback(
    (alert: RootAlert) => {
      acknowledge(alert.watchId);
      runWidget(alert.widgetId, {});
    },
    [acknowledge, runWidget]
  );
  const { runById, runItem } = useRootRun({
    ask,
    items,
    onActivate: token.onActivate,
    openAlert,
    openBoard,
    preview: view.tables?.preview ?? null,
    runWidget,
    startLookup: lookup.start,
  });
  const handleSubmit = useCallback(
    () => runItem(selected),
    [runItem, selected]
  );

  const detailRef = useRef<HTMLDivElement>(null);
  const { commit: commitConnection, interceptChange } = token;
  const modeKeys = useMemo(
    () => ({
      commit:
        mode === "connection"
          ? (item: RootItem) =>
              item.kind === "connection" && commitConnection(item.connection)
          : null,
      focusDetail: mode === "table" ? () => detailRef.current?.focus() : null,
    }),
    [commitConnection, mode]
  );
  const reopen = query === "" ? ask.reopen : null;
  const handleKeyDown = useRootKeyboard({
    modeKeys,
    move,
    onDismissAlert: dismissAlert,
    onOpenActions: openActions,
    onOpenHistory: navigate.openHistory,
    onOpenInputs: args.open,
    onReopen: reopen,
    onRun: runItem,
    selected,
  });

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (interceptChange(event.target.value)) {
        return;
      }
      onQueryChange(event.target.value);
      select(null);
    },
    [interceptChange, onQueryChange, select]
  );

  const menuConnection =
    state.connections.find((connection) => connection.id === menu.openId) ??
    null;
  const actions = menuConnection
    ? connectionActions(
        menuConnection,
        state.liveIds.includes(menuConnection.id)
      )
    : [];
  const footer = footerFor(selected, state.liveIds, mode);
  const { close: handleCloseMenu, run: runAction } = menu;
  const handleRunAction = useCallback(
    (action: ConnectionAction) => {
      if (menuConnection) {
        runAction(action, menuConnection);
      }
    },
    [menuConnection, runAction]
  );

  const argsWidget = args.widget;
  const exitArguments = args.close;
  const argumentControls = useMemo(
    () => ({
      onChange: args.change,
      onExit: exitArguments,
      onRun: (values: ParamValues) => {
        if (argsWidget) {
          runWidget(argsWidget.id, values);
        }
      },
    }),
    [args.change, argsWidget, exitArguments, runWidget]
  );
  const catalogItem = catalog.item;
  const catalogMenu = catalogMenuFor(catalogItem, watches);
  const listMinHeight = Math.max(
    menuConnection ? actionsMenuHeight(actions.length) : 0,
    catalogItem ? actionsMenuHeight(catalogMenu.length) : 0,
    argsWidget ? PILL_POPOVER_SPACE : 0
  );
  const armedId = armedRowId(menu, catalog);

  return (
    <>
      {argsWidget ? (
        <WidgetArgumentsRow
          busy={false}
          controls={argumentControls}
          initialFocus="first"
          values={args.values}
          widget={argsWidget}
        />
      ) : (
        <LauncherInput
          chip={
            <>
              <ActiveConnectionChip
                tone={mode === "connection" ? "pending" : "active"}
              />
              <ModeBadge mode={mode} />
            </>
          }
          inputProps={{
            "aria-activedescendant": selected
              ? optionId(selected.id)
              : undefined,
            "aria-autocomplete": "list",
            "aria-controls": ROOT_LIST_ID,
            "aria-expanded": items.length > 0,
            "aria-label": "Search commands",
            autoFocus: true,
            onChange: handleChange,
            onKeyDown: handleKeyDown,
            placeholder: PLACEHOLDER,
            ref: inputRef,
            role: "combobox",
            value: query,
          }}
          onSubmit={handleSubmit}
        />
      )}
      <div
        className="relative flex min-h-0 flex-1 flex-col border-t border-panel-border"
        style={{ minHeight: listMinHeight }}
      >
        <RootBody
          detail={{ onExit: focusInput, ref: detailRef }}
          list={{
            armedId,
            onHover: select,
            onRun: runById,
            selectedId: selected?.id ?? null,
          }}
          view={view}
        />
        <AnimatePresence>
          {menuConnection ? (
            <ConnectionActionsMenu
              actions={actions}
              armed={menu.armed}
              connection={menuConnection}
              key={menuConnection.id}
              onClose={handleCloseMenu}
              onRun={handleRunAction}
            />
          ) : null}
          {catalogItem ? (
            <ActionsMenu
              actions={catalogMenu}
              anchorId={optionId(catalogItem.id)}
              armedId={catalog.armed ? "delete-board" : null}
              key={catalogItem.id}
              onClose={handleCloseCatalog}
              onRun={handleRunCatalogAction}
              title={catalogTitle(catalogItem)}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <LauncherFooter
        actionLabel={footer.actionLabel}
        hints={reopen ? [...footer.hints, LAST_ANSWER_HINT] : footer.hints}
        status={<RootStatus onReveal={handleReveal} outcome={exportOutcome} />}
      />
    </>
  );
}
