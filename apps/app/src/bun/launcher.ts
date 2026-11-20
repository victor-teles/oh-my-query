import type { LookupValue } from "@conch/core/client";
import type { LauncherNavigateView } from "@conch/rpc";

import Electrobun, {
  BrowserWindow,
  GlobalShortcut,
  Screen,
  Tray,
  Utils,
} from "electrobun/main";

import type { AppRpc } from "./rpc.ts";

import { createMacAccessibility } from "./accessibility-native.ts";
import { requireAccessibility } from "./accessibility.ts";
import {
  LAUNCHER_MIN_HEIGHT,
  launcherFrame,
  resizedFrame,
  workAreaForPoint,
} from "./launcher-geometry.ts";
import { summonPayload } from "./summon-payload.ts";

export interface LauncherController {
  hide(): void;
  markRendererReady(): void;
  navigate(view: LauncherNavigateView): void;
  resize(height: number): void;
  show(): void;
  toggle(): void;
}

interface CreateLauncherOptions {
  hotkey: string;
  rpc: AppRpc;
  url: string;
  releaseFocus: () => void;
  summonOffer: () => LookupValue | null;
}

const TRAY_ACTIONS = {
  open: "launcher:open",
  quit: "launcher:quit",
  settings: "launcher:settings",
} as const;

const cursorWorkArea = () => {
  const primary = Screen.getPrimaryDisplay().workArea;
  const workAreas = Screen.getAllDisplays().map((display) => display.workArea);
  return workAreaForPoint(workAreas, Screen.getCursorScreenPoint(), primary);
};

const actionOf = (event: unknown): string | undefined =>
  (event as { data?: { action?: string } }).data?.action;

export function createLauncher({
  hotkey,
  rpc,
  url,
  releaseFocus,
  summonOffer,
}: CreateLauncherOptions): LauncherController {
  let contentHeight = LAUNCHER_MIN_HEIGHT;
  let rendererReady = false;

  const window = new BrowserWindow({
    frame: launcherFrame(cursorWorkArea(), contentHeight),
    rpc,
    title: "Conch",
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
    show,
    toggle: () => {
      if (window.isVisible()) {
        rpc.send.launcherToggle({});
        return;
      }
      show();
    },
  };

  // Before the renderer subscribes, a dismiss message would be lost, so the
  // native window is hidden directly instead of animating out.
  window.on("blur", () => {
    if (!window.isVisible()) {
      return;
    }
    if (rendererReady) {
      rpc.send.launcherDismiss({});
    } else {
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

  const tray = new Tray({
    height: 18,
    image: "views://assets/tray-template.png",
    template: true,
    width: 18,
  });
  tray.setMenu([
    { action: TRAY_ACTIONS.open, label: "Open Launcher", type: "normal" },
    { action: TRAY_ACTIONS.settings, label: "Settings…", type: "normal" },
    { type: "separator" },
    { action: TRAY_ACTIONS.quit, label: "Quit Conch", type: "normal" },
  ]);
  tray.on("tray-clicked", (event) => {
    switch (actionOf(event)) {
      case TRAY_ACTIONS.open: {
        show();
        break;
      }
      case TRAY_ACTIONS.settings: {
        controller.navigate("settings");
        break;
      }
      case TRAY_ACTIONS.quit: {
        Utils.quit();
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
