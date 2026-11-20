import type { LookupValue } from "@oh-my-query/core/client";
import type { LauncherNavigateView } from "@oh-my-query/rpc";

import Electrobun, {
  BrowserWindow,
  GlobalShortcut,
  Screen,
  Tray,
  Utils,
} from "electrobun/main";

import type { AppRpc } from "./rpc.ts";
import type { TrayStatus } from "./tray-status.ts";

import { createMacAccessibility } from "./accessibility-native.ts";
import { requireAccessibility } from "./accessibility.ts";
import { blurResponse } from "./launcher-blur.ts";
import {
  LAUNCHER_MIN_HEIGHT,
  launcherFrame,
  resizedFrame,
  workAreaForPoint,
} from "./launcher-geometry.ts";
import { summonPayload } from "./summon-payload.ts";
import {
  EMPTY_TRAY_STATUS,
  trayActionOf,
  trayMenu,
  trayTitle,
} from "./tray-status.ts";

export interface LauncherController {
  hide(): void;
  markRendererReady(): void;
  navigate(view: LauncherNavigateView): void;
  resize(height: number): void;
  runModal<T>(openPanel: () => Promise<T>): Promise<T>;
  setTrayStatus(status: TrayStatus): void;
  show(): void;
  toggle(): void;
}

interface CreateLauncherOptions {
  hotkey: string;
  rpc: AppRpc;
  url: string;
  releaseFocus: () => void;
  summonOffer: () => LookupValue | null;
  onWatchedOpened: (watchId: string) => void;
}

const cursorWorkArea = () => {
  const primary = Screen.getPrimaryDisplay().workArea;
  const workAreas = Screen.getAllDisplays().map((display) => display.workArea);
  return workAreaForPoint(workAreas, Screen.getCursorScreenPoint(), primary);
};

export function createLauncher({
  hotkey,
  rpc,
  url,
  releaseFocus,
  summonOffer,
  onWatchedOpened,
}: CreateLauncherOptions): LauncherController {
  let contentHeight = LAUNCHER_MIN_HEIGHT;
  let rendererReady = false;
  let modal = false;
  const shownTray = { menu: "", title: "" };

  const window = new BrowserWindow({
    frame: launcherFrame(cursorWorkArea(), contentHeight),
    rpc,
    title: "oh-my-query",
    titleBarStyle: "hidden",
    transparent: true,
    url,
  });
  window.setAlwaysOnTop(true);
  window.setVisibleOnAllWorkspaces(true);

  const show = () => {
    const frame = launcherFrame(cursorWorkArea(), contentHeight);
    window.setFrame(frame.x, frame.y, frame.width, frame.height);
    window.show();
    window.activate();
    rpc.send.launcherShown(summonPayload(summonOffer));
  };

  const tray = new Tray({
    height: 18,
    image: "views://assets/tray-template.png",
    template: true,
    width: 18,
  });
  // Native menu rebuilds are not free; skip them when nothing visible changed.
  const setTrayStatus = (status: TrayStatus) => {
    const title = trayTitle(status);
    const menu = trayMenu(status);
    const menuKey = JSON.stringify(menu);
    if (title !== shownTray.title) {
      tray.setTitle(title);
      shownTray.title = title;
    }
    if (menuKey !== shownTray.menu) {
      tray.setMenu(menu);
      shownTray.menu = menuKey;
    }
  };
  setTrayStatus(EMPTY_TRAY_STATUS);

  const controller: LauncherController = {
    hide: () => {
      window.hide();
      releaseFocus();
    },
    markRendererReady: () => {
      rendererReady = true;
    },
    navigate: (view) => {
      if (!window.isVisible()) {
        show();
      }
      rpc.send.launcherNavigate({ view });
    },
    resize: (height) => {
      const frame = resizedFrame(window.getFrame(), height);
      contentHeight = frame.height;
      window.setFrame(frame.x, frame.y, frame.width, frame.height);
    },
    runModal: async (openPanel) => {
      modal = true;
      window.setAlwaysOnTop(false);
      try {
        return await openPanel();
      } finally {
        window.setAlwaysOnTop(true);
        window.activate();
        modal = false;
      }
    },
    setTrayStatus,
    show,
    toggle: () => {
      if (window.isVisible()) {
        rpc.send.launcherToggle({});
        return;
      }
      show();
    },
  };

  window.on("blur", () => {
    const response = blurResponse({
      modal,
      rendererReady,
      visible: window.isVisible(),
    });
    if (response === "dismiss") {
      rpc.send.launcherDismiss({});
    } else if (response === "hide") {
      controller.hide();
    }
  });

  if (!GlobalShortcut.register(hotkey, controller.toggle)) {
    console.error(`[launcher] could not register global shortcut ${hotkey}`);
  }
  const accessibility = createMacAccessibility();
  if (accessibility) {
    requireAccessibility(accessibility, () => {
      GlobalShortcut.unregister(hotkey);
      GlobalShortcut.register(hotkey, controller.toggle);
    });
  }

  tray.on("tray-clicked", (event) => {
    const action = trayActionOf(event);
    switch (action?.kind) {
      case "open": {
        show();
        break;
      }
      case "settings": {
        controller.navigate("settings");
        break;
      }
      case "quit": {
        Utils.quit();
        break;
      }
      case "watches": {
        controller.navigate("watches");
        break;
      }
      case "open-watched": {
        controller.navigate({ kind: "widget-run", widgetId: action.widgetId });
        onWatchedOpened(action.watchId);
        break;
      }
      default: {
        break;
      }
    }
  });

  Utils.setDockIconVisible(false);
  // macOS re-shows the Dock icon when the app is reopened from Finder/Spotlight.
  Electrobun.events.on("reopen", () => {
    Utils.setDockIconVisible(false);
    show();
  });

  return controller;
}
