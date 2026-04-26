import {
  ArrowRightIcon,
  CodeIcon,
  Columns2Icon,
  FilePlusIcon,
  HistoryIcon,
  KeyboardIcon,
  ListRestartIcon,
  MessageSquareIcon,
  PlayIcon,
  RotateCwIcon,
  SidebarIcon,
  SquareIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";

import type { CommandAction } from "@/components/command-palette/types";
import type { QueryTab } from "@/lib/query-types";
import type { WorkspaceMode } from "@/lib/workspace-mode";

import { useRegisterCommandActions } from "@/components/command-palette/use-register-command-actions";
import { useHistoryPanel } from "@/hooks/use-history-panel";

interface WorkspaceQueryActionsProps {
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  isSql: boolean;
  onRun: () => void;
  onFormat: () => void;
  onCancel: () => void;
  onNewTab: () => void;
  onCloseTab: () => void;
  onReopenTab: () => void;
  onSwitchTab: (id: string) => void;
}

export const WorkspaceQueryActions = ({
  tabs,
  activeTab,
  isSql,
  onRun,
  onFormat,
  onCancel,
  onNewTab,
  onCloseTab,
  onReopenTab,
  onSwitchTab,
}: WorkspaceQueryActionsProps) => {
  const actions = useMemo<CommandAction[]>(() => {
    const isRunning = activeTab?.status === "running";
    const hasSql = Boolean(activeTab?.sql.trim());

    const list: CommandAction[] = [
      {
        group: "Query",
        icon: PlayIcon,
        id: "query.run",
        keywords: ["execute", "go"],
        label: "Run Query",
        perform: onRun,
        shortcut: ["⌘", "↵"],
        when: () => hasSql && !isRunning,
      },
      {
        group: "Query",
        icon: SquareIcon,
        id: "query.cancel",
        keywords: ["stop", "abort"],
        label: "Cancel Running Query",
        perform: onCancel,
        when: () => isRunning,
      },
      {
        group: "Query",
        icon: WandSparklesIcon,
        id: "query.format",
        keywords: ["prettify", "beautify"],
        label: "Format SQL",
        perform: onFormat,
        shortcut: ["⌘", "⇧", "F"],
        when: () => isSql && hasSql,
      },
      {
        group: "Tabs",
        icon: FilePlusIcon,
        id: "tabs.new",
        label: "New Tab",
        perform: onNewTab,
        shortcut: ["⌘", "T"],
      },
      {
        destructive: true,
        group: "Tabs",
        icon: XIcon,
        id: "tabs.close",
        label: "Close Tab",
        perform: onCloseTab,
        shortcut: ["⌘", "W"],
        when: () => !!activeTab,
      },
      {
        group: "Tabs",
        icon: ListRestartIcon,
        id: "tabs.reopen",
        label: "Reopen Last Tab",
        perform: onReopenTab,
        shortcut: ["⌘", "⇧", "T"],
      },
    ];

    for (let index = 0; index < tabs.length; index += 1) {
      const tab = tabs[index];
      if (!tab) {
        continue;
      }
      if (tab.id === activeTab?.id) {
        continue;
      }
      list.push({
        group: "Tabs",
        icon: ArrowRightIcon,
        id: `tabs.switch.${tab.id}`,
        keywords: ["tab", tab.title ?? ""],
        label: `Switch to ${tab.title || `Tab ${index + 1}`}`,
        perform: () => onSwitchTab(tab.id),
        shortcut: index < 9 ? ["⌘", String(index + 1)] : undefined,
      });
    }

    return list;
  }, [
    tabs,
    activeTab,
    isSql,
    onRun,
    onFormat,
    onCancel,
    onNewTab,
    onCloseTab,
    onReopenTab,
    onSwitchTab,
  ]);

  useRegisterCommandActions(actions, [actions]);

  return null;
};

interface WorkspaceLayoutActionsProps {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  onToggleSidebar: () => void;
  onShowShortcuts: () => void;
  onReconnect: () => void;
  connectionName: string;
}

export const WorkspaceLayoutActions = ({
  mode,
  setMode,
  onToggleSidebar,
  onShowShortcuts,
  onReconnect,
  connectionName,
}: WorkspaceLayoutActionsProps) => {
  const { setOpen: openHistory } = useHistoryPanel();

  const actions = useMemo<CommandAction[]>(
    () => [
      {
        group: "View",
        icon: SidebarIcon,
        id: "view.toggle-sidebar",
        label: "Toggle Sidebar",
        perform: onToggleSidebar,
        shortcut: ["⌘", "B"],
      },
      {
        group: "View",
        icon: HistoryIcon,
        id: "view.query-history",
        keywords: ["log", "recent", "past queries"],
        label: "Open Query History",
        perform: () => openHistory(true),
        shortcut: ["⌘", "⇧", "H"],
      },
      {
        group: "View",
        icon: CodeIcon,
        id: "view.mode.editor",
        label: "Editor Mode",
        perform: () => setMode("editor"),
        shortcut: ["⌘", "⇧", "1"],
        when: () => mode !== "editor",
      },
      {
        group: "View",
        icon: Columns2Icon,
        id: "view.mode.split",
        label: "Split Mode",
        perform: () => setMode("split"),
        shortcut: ["⌘", "⇧", "2"],
        when: () => mode !== "split",
      },
      {
        group: "View",
        icon: MessageSquareIcon,
        id: "view.mode.chat",
        label: "Chat Mode",
        perform: () => setMode("chat"),
        shortcut: ["⌘", "⇧", "3"],
        when: () => mode !== "chat",
      },
      {
        group: "View",
        icon: KeyboardIcon,
        id: "view.shortcuts",
        label: "Show Keyboard Shortcuts",
        perform: onShowShortcuts,
        shortcut: ["⌘", "/"],
      },
      {
        group: "Connection",
        icon: RotateCwIcon,
        id: "connection.reconnect",
        keywords: ["retry", "refresh connection"],
        label: `Reconnect to ${connectionName}`,
        perform: onReconnect,
      },
    ],
    [
      mode,
      setMode,
      onToggleSidebar,
      onShowShortcuts,
      onReconnect,
      connectionName,
      openHistory,
    ]
  );

  useRegisterCommandActions(actions, [actions]);

  return null;
};
