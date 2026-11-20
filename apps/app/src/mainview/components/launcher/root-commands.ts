import type { LucideIcon } from "lucide-react";

import {
  DownloadIcon,
  EyeOffIcon,
  HistoryIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  UploadIcon,
} from "lucide-react";

import { fuzzyMatch } from "@/lib/fuzzy-match";

export interface LauncherCommand {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actionLabel: string;
  shortcut?: readonly string[];
  keywords?: readonly string[];
  run: () => void;
}

interface RootCommandHandlers {
  addConnection: () => void;
  newBoard: () => void;
  openHistory: () => void;
  openSettings: () => void;
  exportAll: () => void;
  openImport: () => void;
  dismiss: () => void;
}

export const rootCommands = ({
  addConnection,
  newBoard,
  openHistory,
  openSettings,
  exportAll,
  openImport,
  dismiss,
}: RootCommandHandlers): LauncherCommand[] => [
  {
    actionLabel: "Add",
    icon: PlusIcon,
    id: "add-connection",
    keywords: ["new", "database", "connect", "postgres", "mysql", "sqlite"],
    run: addConnection,
    subtitle: "PostgreSQL, MySQL, SQLite and more",
    title: "Add Connection",
  },
  {
    actionLabel: "Create",
    icon: LayoutGridIcon,
    id: "new-board",
    keywords: ["board", "dashboard", "grid", "tiles"],
    run: newBoard,
    subtitle: "A live grid of widgets with shared inputs",
    title: "New Board",
  },
  {
    actionLabel: "Open",
    icon: HistoryIcon,
    id: "history",
    keywords: ["history", "recent", "past", "asks"],
    run: openHistory,
    shortcut: ["⌘", "Y"],
    subtitle: "Every question you've asked",
    title: "Search History",
  },
  {
    actionLabel: "Open",
    icon: SlidersHorizontalIcon,
    id: "settings",
    keywords: ["preferences", "hotkey", "theme", "appearance", "ai", "model"],
    run: openSettings,
    shortcut: ["⌘", ","],
    subtitle: "AI provider, hotkey and appearance",
    title: "Settings",
  },
  {
    actionLabel: "Export",
    icon: DownloadIcon,
    id: "export-bundle",
    keywords: ["share", "backup", "save", "file", "json"],
    run: exportAll,
    subtitle: "Saves a .omq.json to Downloads",
    title: "Export Widgets and Boards",
  },
  {
    actionLabel: "Import",
    icon: UploadIcon,
    id: "import-bundle",
    keywords: ["share", "restore", "load", "file", "json", "clipboard"],
    run: openImport,
    subtitle: "From the clipboard or a .omq.json file",
    title: "Import Widgets and Boards…",
  },
  {
    actionLabel: "Hide",
    icon: EyeOffIcon,
    id: "hide",
    keywords: ["close", "dismiss"],
    run: dismiss,
    shortcut: ["esc"],
    subtitle: "Return to what you were doing",
    title: "Hide Launcher",
  },
];

export const aiSetupCommand = (openSettings: () => void): LauncherCommand => ({
  actionLabel: "Open Settings",
  icon: KeyRoundIcon,
  id: "ai-setup",
  run: openSettings,
  subtitle: "Questions need a model to answer them",
  title: "Set up an AI provider to ask questions →",
});

const bestScore = (command: LauncherCommand, query: string): number | null => {
  const candidates = [command.title, ...(command.keywords ?? [])];
  let best: number | null = null;
  for (const candidate of candidates) {
    const match = fuzzyMatch(candidate, query);
    if (match && (best === null || match.score > best)) {
      best = match.score;
    }
  }
  return best;
};

export const filterCommands = (
  commands: readonly LauncherCommand[],
  query: string
): LauncherCommand[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...commands];
  }
  return commands
    .map((command) => ({ command, score: bestScore(command, trimmed) }))
    .filter(
      (entry): entry is { command: LauncherCommand; score: number } =>
        entry.score !== null
    )
    .toSorted((a, b) => b.score - a.score)
    .map((entry) => entry.command);
};
