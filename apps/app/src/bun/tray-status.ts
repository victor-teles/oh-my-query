import type { MenuItemConfig } from "electrobun/main";

import { timeAgo } from "@oh-my-query/rpc";
import { z } from "zod";

export const TRAY_ACTIONS = {
  open: "launcher:open",
  openWatched: "watch:open",
  quit: "launcher:quit",
  settings: "launcher:settings",
  watches: "watch:list",
} as const;

export const MAX_TITLE_LENGTH = 10;
export const MAX_TRAY_ALERTS = 5;
export const STALE_AFTER_INTERVALS = 3;

export interface PinnedStatus {
  watchId: string;
  widgetId: string;
  widgetName: string;
  display: string | null;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  failing: boolean;
  intervalMs: number;
}

export interface TrayAlert {
  watchId: string;
  widgetId: string;
  label: string;
  firedAt: number;
}

export interface TrayStatus {
  now: number;
  pinned: PinnedStatus | null;
  alerts: readonly TrayAlert[];
  watching: number;
  paused: boolean;
}

export const EMPTY_TRAY_STATUS: TrayStatus = {
  alerts: [],
  now: 0,
  paused: false,
  pinned: null,
  watching: 0,
};

const ellipsize = (text: string): string =>
  text.length > MAX_TITLE_LENGTH
    ? `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : text;

const isFresh = (pinned: PinnedStatus, now: number): boolean =>
  pinned.lastSuccessAt !== null &&
  now - pinned.lastSuccessAt <= STALE_AFTER_INTERVALS * pinned.intervalMs;

export const trayTitle = ({ pinned, now }: TrayStatus): string => {
  if (!pinned) {
    return "";
  }
  return pinned.display !== null && isFresh(pinned, now)
    ? ellipsize(pinned.display)
    : "—";
};

const pinnedLine = (pinned: PinnedStatus, status: TrayStatus): string => {
  const parts = [pinned.widgetName];
  if (status.paused) {
    parts.push("watching paused");
  } else if (pinned.failing) {
    parts.push("couldn't refresh");
  } else {
    parts.push(pinned.display ?? "waiting for the first run");
  }
  const at = pinned.failing ? pinned.lastAttemptAt : pinned.lastSuccessAt;
  if (at !== null) {
    parts.push(timeAgo(at, status.now));
  }
  return parts.join(" · ");
};

const openItem = (
  label: string,
  target: { watchId: string; widgetId: string }
): MenuItemConfig => ({
  action: TRAY_ACTIONS.openWatched,
  data: target,
  label,
  type: "normal",
});

const watchingLabel = ({ watching, paused }: TrayStatus): string => {
  const count = watching === 1 ? "1 widget" : `${watching} widgets`;
  return paused ? `Watching paused · ${count}…` : `Watching ${count}…`;
};

const BASE_MENU: MenuItemConfig[] = [
  { action: TRAY_ACTIONS.open, label: "Open Launcher", type: "normal" },
  { action: TRAY_ACTIONS.settings, label: "Settings…", type: "normal" },
  { type: "separator" },
  { action: TRAY_ACTIONS.quit, label: "Quit oh-my-query", type: "normal" },
];

export const trayMenu = (status: TrayStatus): MenuItemConfig[] => {
  const { pinned, alerts, now } = status;
  const watchItems: MenuItemConfig[] = [];
  if (pinned) {
    watchItems.push(
      {
        enabled: false,
        label: pinnedLine(pinned, status),
        type: "normal",
      },
      openItem(`Open ${pinned.widgetName}`, pinned)
    );
  }
  for (const alert of alerts.slice(0, MAX_TRAY_ALERTS)) {
    watchItems.push(
      openItem(`${alert.label} · ${timeAgo(alert.firedAt, now)}`, alert)
    );
  }
  if (status.watching > 0) {
    watchItems.push({
      action: TRAY_ACTIONS.watches,
      label: watchingLabel(status),
      type: "normal",
    });
  }
  return watchItems.length > 0
    ? [...watchItems, { type: "separator" }, ...BASE_MENU]
    : BASE_MENU;
};

export type TrayAction =
  | { kind: "open" }
  | { kind: "settings" }
  | { kind: "quit" }
  | { kind: "watches" }
  | { kind: "open-watched"; watchId: string; widgetId: string };

const Target = z.object({
  watchId: z.string().min(1).max(100),
  widgetId: z.string().min(1).max(100),
});

const TrayClick = z.object({
  data: z.object({ action: z.string(), data: z.unknown().optional() }),
});

export const trayActionOf = (event: unknown): TrayAction | null => {
  const click = TrayClick.safeParse(event);
  if (!click.success) {
    return null;
  }
  const { action, data } = click.data.data;
  switch (action) {
    case TRAY_ACTIONS.open: {
      return { kind: "open" };
    }
    case TRAY_ACTIONS.settings: {
      return { kind: "settings" };
    }
    case TRAY_ACTIONS.quit: {
      return { kind: "quit" };
    }
    case TRAY_ACTIONS.watches: {
      return { kind: "watches" };
    }
    case TRAY_ACTIONS.openWatched: {
      const target = Target.safeParse(data);
      return target.success ? { kind: "open-watched", ...target.data } : null;
    }
    default: {
      return null;
    }
  }
};
